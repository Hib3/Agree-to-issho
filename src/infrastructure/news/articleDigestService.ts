import type {
  ArticleContentLevel,
  ArticleDigest,
  ArticleEvidence,
  ArticleFetchAttempt,
  ArticleFetchResult,
  ArticleFetchTrace,
  ArticleIssue,
  ArticleTone,
  NewsItem
} from "../../domain/model/news";
import { cleanFeedText } from "../../domain/news/rssParser";

const ARTICLE_TIMEOUT_MS = 12_000;
const MAX_ARTICLE_BYTES = 1_000_000;
const MAX_ARTICLE_CHARACTERS = 8_000;
const MAX_ARTICLE_PARAGRAPHS = 20;
const READER_ENDPOINT = "https://r.jina.ai/";

export function buildFeedDigest(item: NewsItem, now = Date.now()): ArticleDigest {
  const usefulFeedContent = item.feedContent && assessArticleText(item.feedContent, item.title).useful;
  const contentLevel: ArticleContentLevel = usefulFeedContent
    ? "feed_content"
    : item.summary
      ? "feed_summary"
      : "headline_only";
  const evidence: ArticleEvidence[] = [{ id: `${item.id}_headline`, text: item.title, source: "headline" }];
  if (item.summary) evidence.push({ id: `${item.id}_summary`, text: item.summary, source: "feed_summary" });
  if (usefulFeedContent && item.feedContent)
    evidence.push(
      ...sentences(item.feedContent, 3).map((text, index) => ({
        id: `${item.id}_feed_${index}`,
        text,
        source: "feed_content" as const
      }))
    );
  return digestFromEvidence(
    item,
    evidence,
    contentLevel,
    item.url,
    now,
    contentLevel === "headline_only"
      ? ["見出し以外の内容は取得できていません。"]
      : ["RSSに含まれない背景や文脈は確認できていません。"]
  );
}

export async function fetchArticleDigest(
  item: NewsItem,
  options: {
    useArticleHelper: boolean;
    signal?: AbortSignal | undefined;
    now?: number | undefined;
    attemptDirect?: boolean | undefined;
    previousTrace?: ArticleFetchTrace | undefined;
  }
): Promise<ArticleFetchResult> {
  const now = options.now ?? Date.now();
  const fallback = buildFeedDigest(item, now);
  const trace: ArticleFetchTrace = options.previousTrace
    ? {
        ...options.previousTrace,
        attempts: options.previousTrace.attempts.filter(
          (attempt) =>
            attempt.method !== "fallback_headline" &&
            !(attempt.method === "reader_helper" && attempt.result === "disabled")
        )
      }
    : { articleUrl: item.url, startedAt: now, attempts: [], finalContentLevel: fallback.contentLevel };

  if (!options.previousTrace) {
    const feedStartedAt = Date.now();
    if (fallback.contentLevel === "feed_content") {
      trace.attempts.push({
        method: "feed_content",
        startedAt: feedStartedAt,
        finishedAt: Date.now(),
        result: "success",
        extractedCharacters: item.feedContent ? Array.from(item.feedContent).length : 0
      });
      return finishArticleFetch(fallback, trace, false);
    }
    trace.attempts.push({
      method: "feed_content",
      startedAt: feedStartedAt,
      finishedAt: Date.now(),
      result: item.feedContent ? "too_short" : "disabled",
      extractedCharacters: item.feedContent ? Array.from(item.feedContent).length : 0,
      detail: item.feedContent ? "RSS本文は本文品質条件を満たしませんでした。" : "RSS本文はありません。"
    });
  }

  let directFailure = [...(options.previousTrace?.attempts ?? [])]
    .reverse()
    .find((attempt) => attempt.method === "direct_article")?.detail;
  if (options.attemptDirect !== false) {
    const startedAt = Date.now();
    try {
      const response = await fetchArticleText(
        item.url,
        "text/html, application/xhtml+xml, text/plain",
        options.signal
      );
      const text = extractArticleText(response.text, response.contentType);
      const assessment = assessArticleText(text, item.title);
      trace.attempts.push({
        method: "direct_article",
        startedAt,
        finishedAt: Date.now(),
        result: assessment.useful ? "success" : "too_short",
        statusCode: response.statusCode,
        contentType: response.contentType,
        extractedCharacters: Array.from(text).length,
        ...(!assessment.useful ? { detail: assessment.reason } : {})
      });
      if (assessment.useful)
        return finishArticleFetch(digestFromArticle(item, text, response.finalUrl, now), trace, false);
      directFailure = assessment.reason;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      const failure = articleAttemptFailure(error);
      directFailure = failure.detail;
      trace.attempts.push({
        method: "direct_article",
        startedAt,
        finishedAt: Date.now(),
        result: failure.result,
        ...(failure.statusCode ? { statusCode: failure.statusCode } : {}),
        ...(failure.contentType ? { contentType: failure.contentType } : {}),
        detail: failure.detail
      });
    }
  }

  if (!options.useArticleHelper) {
    const helperTime = Date.now();
    trace.attempts.push({
      method: "reader_helper",
      startedAt: helperTime,
      finishedAt: helperTime,
      result: "disabled",
      detail: "記事取得補助は許可されていません。"
    });
    return finishArticleFetch(
      {
        ...fallback,
        uncertainties: [...fallback.uncertainties, directFailure].filter((value): value is string =>
          Boolean(value)
        )
      },
      trace,
      true,
      directFailure
    );
  }

  const helperStartedAt = Date.now();
  try {
    const response = await fetchArticleText(`${READER_ENDPOINT}${item.url}`, "text/plain", options.signal);
    const text = extractReaderText(response.text);
    const assessment = assessArticleText(text, item.title);
    trace.attempts.push({
      method: "reader_helper",
      startedAt: helperStartedAt,
      finishedAt: Date.now(),
      result: assessment.useful ? "success" : "too_short",
      statusCode: response.statusCode,
      contentType: response.contentType,
      extractedCharacters: Array.from(text).length,
      ...(!assessment.useful ? { detail: assessment.reason } : {})
    });
    if (assessment.useful)
      return finishArticleFetch(digestFromArticle(item, text, item.url, now), trace, false);
    directFailure = assessment.reason;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    const failure = articleAttemptFailure(error);
    directFailure = failure.detail;
    trace.attempts.push({
      method: "reader_helper",
      startedAt: helperStartedAt,
      finishedAt: Date.now(),
      result: failure.result,
      ...(failure.statusCode ? { statusCode: failure.statusCode } : {}),
      ...(failure.contentType ? { contentType: failure.contentType } : {}),
      detail: failure.detail
    });
  }

  return finishArticleFetch(
    {
      ...fallback,
      uncertainties: [...fallback.uncertainties, directFailure].filter((value): value is string =>
        Boolean(value)
      )
    },
    trace,
    false,
    directFailure
  );
}

function finishArticleFetch(
  digest: ArticleDigest,
  trace: ArticleFetchTrace,
  needsHelperConsent: boolean,
  directFailureReason?: string
): ArticleFetchResult {
  const fallbackTime = Date.now();
  if (digest.contentLevel !== "article_extract" && digest.contentLevel !== "feed_content") {
    trace.attempts.push({
      method: "fallback_headline",
      startedAt: fallbackTime,
      finishedAt: fallbackTime,
      result: "success",
      extractedCharacters: digest.keySentences.reduce((sum, entry) => sum + Array.from(entry.text).length, 0),
      detail:
        digest.contentLevel === "feed_summary" ? "RSSの短い説明を使用します。" : "見出しだけを使用します。"
    });
  }
  trace.finalContentLevel = digest.contentLevel;
  return {
    digest,
    trace,
    needsHelperConsent,
    ...(directFailureReason ? { directFailureReason } : {})
  };
}

function digestFromArticle(item: NewsItem, text: string, sourceUrl: string, now: number) {
  const articleEvidence = sentences(text, 6).map((sentence, index) => ({
    id: `${item.id}_article_${index}`,
    text: sentence,
    source: "article" as const
  }));
  const evidence: ArticleEvidence[] = [
    { id: `${item.id}_headline`, text: item.title, source: "headline" },
    ...articleEvidence
  ];
  return digestFromEvidence(item, evidence, "article_extract", sourceUrl, now, [
    "取得できた本文の一部だけを使っています。記事全体の文脈は元記事で確認が必要です。"
  ]);
}

function digestFromEvidence(
  item: NewsItem,
  evidence: ArticleEvidence[],
  contentLevel: ArticleContentLevel,
  sourceUrl: string,
  now: number,
  uncertainties: string[]
): ArticleDigest {
  const headline = evidence.find((entry) => entry.source === "headline")?.text ?? item.title;
  const usableFacts = evidence
    .filter((entry) => entry.source !== "headline" && !isNearDuplicate(entry.text, headline))
    .slice(0, 4);
  const keyFacts = usableFacts.map((entry, index) => ({
    id: `${item.id}_fact_${index}`,
    text: entry.text,
    evidenceId: entry.id
  }));
  const combined = evidence.map((entry) => entry.text).join(" ");
  const tone = classifyTone(combined);
  const topics = classifyTopics(combined);
  const numericalFacts = evidence
    .flatMap((entry) =>
      Array.from(
        entry.text.matchAll(
          /(?:約|およそ|最大|最低)?\s*[0-9０-９][0-9０-９,.，]*\s*(?:人|件|回|年|月|日|時|分|秒|％|%|円|ドル|キロ|km|駅|社|か所|カ所)?/gu
        )
      )
        .slice(0, 3)
        .map((match) => ({ value: match[0].trim(), context: entry.text, evidenceId: entry.id }))
    )
    .slice(0, 6);
  const entities = extractEntities(combined);
  const issues = extractArticleIssues(item.id, keyFacts, numericalFacts, entities, uncertainties);
  return {
    newsItemId: item.id,
    contentLevel,
    sourceUrl,
    extractedAt: now,
    keyFacts,
    keySentences: evidence.slice(0, 7),
    entities,
    topics,
    events: keyFacts.slice(0, 2).map((fact, index) => ({
      id: `${item.id}_event_${index}`,
      description: fact.text,
      evidenceId: fact.evidenceId
    })),
    numericalFacts,
    issues,
    uncertainties,
    tone,
    confidence:
      contentLevel === "article_extract"
        ? 0.78
        : contentLevel === "feed_content"
          ? 0.65
          : contentLevel === "feed_summary"
            ? 0.5
            : 0.25
  };
}

function isNearDuplicate(candidate: string, reference: string) {
  const left = comparableText(candidate);
  const right = comparableText(reference);
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= 12 && longer.includes(shorter) && shorter.length / longer.length >= 0.65;
}

function comparableText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

export function assessArticleText(text: string, headline: string) {
  const cleaned = cleanFeedText(text, MAX_ARTICLE_CHARACTERS);
  const characters = Array.from(cleaned).length;
  if (characters < 80) return { useful: false as const, reason: "本文として使える文字数が足りません。" };
  if (isNearDuplicate(cleaned, headline))
    return { useful: false as const, reason: "見出しとほぼ同じ内容だけでした。" };
  const segments = cleaned
    .split(/(?<=[。！？!?])\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const boilerplate = segments.filter((part) =>
    /(cookie|クッキー|広告|プライバシー|利用規約|ログイン|会員登録|通知を許可|JavaScriptを有効|サイトについて)/iu.test(
      part
    )
  );
  if (boilerplate.length > 0 && boilerplate.length / Math.max(1, segments.length) >= 0.6)
    return { useful: false as const, reason: "広告やサイト案内が中心で、記事本文を確認できませんでした。" };
  if (segments.length < 2 && characters < 180)
    return { useful: false as const, reason: "独立した文が一つしかなく、本文として判断できませんでした。" };
  const hasVerb =
    /(発表|開始|予定|決定|確認|公開|導入|実施|報告|対応|改善|増加|減少|行う|行った|している|された|となる|なった|する|した|is|are|was|were|will|has|have|said|announced|reported)/iu.test(
      cleaned
    );
  const hasSpecificDetail =
    /[0-9０-９]|(?:市|県|町|村|駅|大学|会社|庁|省|党|チーム|研究所)|(?:によると|同社|自治体|政府|研究|利用者)/u.test(
      cleaned
    );
  if (!hasVerb || !hasSpecificDetail)
    return { useful: false as const, reason: "出来事を示す動作や固有情報を十分に確認できませんでした。" };
  return { useful: true as const, reason: "" };
}

function extractArticleIssues(
  itemId: string,
  facts: ArticleDigest["keyFacts"],
  numericalFacts: ArticleDigest["numericalFacts"],
  entities: ArticleDigest["entities"],
  uncertainties: string[]
): ArticleIssue[] {
  const issues: ArticleIssue[] = facts.map((fact, index) => {
    const kind = issueKind(fact.text);
    return {
      id: `${itemId}_issue_${index}`,
      label: issueLabel(kind),
      summary: fact.text,
      evidenceIds: [fact.id, fact.evidenceId],
      kind,
      importance: Math.min(1, 0.58 + (/(重要|影響|被害|変更|開始|停止|決定)/u.test(fact.text) ? 0.18 : 0)),
      relevanceToUser: /(生活|利用者|料金|交通|健康|安全|学校|仕事)/u.test(fact.text) ? 0.78 : 0.48,
      suitabilityForOpinion: kind === "cause" || kind === "uncertainty" ? 0.45 : 0.72
    };
  });
  for (const [index, numerical] of numericalFacts.entries()) {
    if (issues.some((issue) => issue.evidenceIds.includes(numerical.evidenceId))) continue;
    issues.push({
      id: `${itemId}_issue_number_${index}`,
      label: "数字と規模",
      summary: numerical.context,
      evidenceIds: [numerical.evidenceId],
      kind: "number",
      importance: 0.72,
      relevanceToUser: 0.52,
      suitabilityForOpinion: 0.68
    });
  }
  for (const [index, entity] of entities.entries()) {
    if (issues.length >= 5 || entity.kind === "other") continue;
    issues.push({
      id: `${itemId}_issue_entity_${index}`,
      label: entity.kind === "place" ? "関係する場所" : "関係する人や組織",
      summary: `${entity.name}が記事内で言及されています。`,
      evidenceIds: [],
      kind: entity.kind === "place" ? "place" : "person",
      importance: 0.5,
      relevanceToUser: 0.42,
      suitabilityForOpinion: 0.45
    });
  }
  if (issues.length === 0 && uncertainties[0]) {
    issues.push({
      id: `${itemId}_issue_uncertainty`,
      label: "まだ分からないこと",
      summary: uncertainties[0],
      evidenceIds: [],
      kind: "uncertainty",
      importance: 0.45,
      relevanceToUser: 0.35,
      suitabilityForOpinion: 0.25
    });
  }
  return issues.sort((left, right) => right.importance - left.importance).slice(0, 6);
}

function issueKind(text: string): ArticleIssue["kind"] {
  if (/(原因|ため|理由|背景|きっかけ)/u.test(text)) return "cause";
  if (/(影響|結果|ことになる|受ける)/u.test(text)) return "effect";
  if (/(改善|便利|利点|可能になる|支援)/u.test(text)) return "benefit";
  if (/(危険|懸念|被害|問題|不足|停止)/u.test(text)) return "risk";
  if (/(対立|反対|一方|争い|批判)/u.test(text)) return "conflict";
  if (/[0-9０-９]/u.test(text)) return "number";
  return "change";
}

function issueLabel(kind: ArticleIssue["kind"]) {
  return {
    change: "起きる変化",
    cause: "変化の理由",
    effect: "考えられる影響",
    benefit: "期待される利点",
    risk: "気になる点",
    conflict: "意見が分かれる点",
    number: "数字と規模",
    person: "関係する人",
    place: "関係する場所",
    uncertainty: "まだ分からないこと"
  }[kind];
}

function extractArticleText(source: string, contentType: string) {
  if (!/html/iu.test(contentType) && !/<(?:html|article|main|p)[\s>]/iu.test(source)) {
    return limitArticleText(source.split(/\r?\n/u));
  }
  const document = new DOMParser().parseFromString(source, "text/html");
  document
    .querySelectorAll(
      "nav, aside, footer, form, dialog, script, style, noscript, iframe, .advertisement, .ads, .social, .share, .comments, .related, .cookie, [role='navigation'], [aria-label*='広告']"
    )
    .forEach((node) => node.remove());
  const root = document.querySelector("article") ?? document.querySelector("main") ?? document.body;
  const paragraphs = Array.from(root.querySelectorAll("p"))
    .map((node) => node.textContent ?? "")
    .filter((text) => text.trim().length >= 20);
  if (paragraphs.length === 0) paragraphs.push(root.textContent ?? "");
  return limitArticleText(paragraphs);
}

function extractReaderText(markdown: string) {
  const lines = markdown
    .split(/\r?\n/u)
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/u, "")
        .replace(/!\[[^\]]*\]\([^)]+\)/gu, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
        .trim()
    )
    .filter(
      (line) => line.length >= 20 && !/^(?:Title|URL Source|Published Time|Markdown Content):/iu.test(line)
    );
  return limitArticleText(lines);
}

function limitArticleText(parts: string[]) {
  const seen = new Set<string>();
  const selected: string[] = [];
  let characters = 0;
  for (const raw of parts) {
    const text = cleanFeedText(raw, 1_200);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const remaining = MAX_ARTICLE_CHARACTERS - characters;
    if (remaining <= 0 || selected.length >= MAX_ARTICLE_PARAGRAPHS) break;
    const clipped = Array.from(text).slice(0, remaining).join("");
    selected.push(clipped);
    characters += Array.from(clipped).length;
  }
  return selected.join("\n");
}

async function fetchArticleText(url: string, accept: string, parentSignal?: AbortSignal) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ArticleRequestError("parse_error", "記事URLを解釈できませんでした。");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new ArticleRequestError("parse_error", "公開されたHTTPSの記事だけ取得できます。");
  const controller = new AbortController();
  const onAbort = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener("abort", onAbort, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort("timeout"), ARTICLE_TIMEOUT_MS);
  try {
    const response = await fetch(parsed.href, {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { Accept: accept }
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok)
      throw new ArticleRequestError("http_error", `記事サーバーがHTTP ${response.status}を返しました。`, {
        statusCode: response.status,
        contentType
      });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_ARTICLE_BYTES)
      throw new ArticleRequestError("parse_error", "記事が大きすぎるため読み込みを止めました。", {
        statusCode: response.status,
        contentType
      });
    const text = await readArticleBody(response, controller);
    return {
      text,
      finalUrl: response.url || parsed.href,
      contentType,
      statusCode: response.status
    };
  } catch (error) {
    if (parentSignal?.aborted) throw error;
    if (controller.signal.aborted && controller.signal.reason === "timeout")
      throw new ArticleRequestError("timeout", "記事の取得が時間切れになりました。");
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onAbort);
  }
}

async function readArticleBody(response: Response, controller: AbortController) {
  if (!response.body) {
    const text = await response.text();
    if (new Blob([text]).size > MAX_ARTICLE_BYTES)
      throw new ArticleRequestError("parse_error", "記事が大きすぎるため読み込みを止めました。");
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > MAX_ARTICLE_BYTES) {
      controller.abort("size");
      throw new ArticleRequestError("parse_error", "記事が大きすぎるため読み込みを止めました。");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

function sentences(text: string, limit: number) {
  return text
    .split(/(?<=[。！？!?])\s*/u)
    .map((part) => cleanFeedText(part, 320))
    .filter((part) => part.length >= 8)
    .slice(0, limit);
}

function classifyTone(text: string): ArticleTone {
  if (
    /(死亡|死者|亡くな|重大事故|災害|地震|戦争|犯罪|逮捕|病気|医療|自傷|自殺|差別|選挙|政府|国会|首相|大統領)/u.test(
      text
    )
  )
    return "sensitive";
  const positive = /(改善|成功|回復|達成|受賞|開業|再開|増加)/u.test(text);
  const negative = /(悪化|失敗|減少|停止|中止|被害|不足)/u.test(text);
  if (positive && negative) return "mixed";
  if (positive) return "positive";
  if (negative) return "negative";
  return text ? "neutral" : "unknown";
}

function classifyTopics(text: string) {
  const definitions: Array<[RegExp, string, string]> = [
    [/(天気|気温|台風|大雨|地震|災害|雪|猛暑)/u, "weather_safety", "天気と安全"],
    [/(選挙|政府|国会|首相|大統領|法律|自治体)/u, "society_politics", "社会と政治"],
    [/(株|市場|経済|企業|物価|円相場|金融)/u, "economy", "経済"],
    [/(AI|人工知能|技術|科学|宇宙|アプリ|コンピュータ)/iu, "science_technology", "科学と技術"],
    [/(試合|優勝|選手|大会|リーグ|スポーツ)/u, "sports", "スポーツ"],
    [/(映画|音楽|本|作品|芸術|文化)/u, "culture", "文化"],
    [/(病院|医療|健康|感染|薬)/u, "health", "健康"],
    [/(電車|鉄道|道路|交通|空港|運休|駅)/u, "transport", "交通"]
  ];
  const matched = definitions
    .filter(([pattern]) => pattern.test(text))
    .map(([, key, label]) => ({ key, label }));
  return matched.length > 0 ? matched.slice(0, 3) : [{ key: "general", label: "世の中の出来事" }];
}

function extractEntities(text: string) {
  const matches = Array.from(
    text.matchAll(/[一-龠々ァ-ヶーA-Za-z0-9]{2,20}(?:市|県|町|村|駅|大学|会社|庁|省|党|チーム|研究所)/gu)
  );
  const unique = [...new Set(matches.map((match) => match[0]))].slice(0, 8);
  return unique.map((name) => ({
    name,
    kind: /(?:市|県|町|村|駅)$/u.test(name)
      ? ("place" as const)
      : /(?:会社|庁|省|党|チーム|大学|研究所)$/u.test(name)
        ? ("organization" as const)
        : ("other" as const)
  }));
}

class ArticleRequestError extends Error {
  constructor(
    readonly result: ArticleFetchAttempt["result"],
    message: string,
    readonly metadata: { statusCode?: number; contentType?: string } = {}
  ) {
    super(message);
  }
}

function articleAttemptFailure(error: unknown) {
  if (error instanceof ArticleRequestError) {
    return {
      result: error.result,
      detail: error.message,
      ...error.metadata
    };
  }
  if (error instanceof DOMException && error.name === "AbortError")
    return { result: "timeout" as const, detail: "記事の取得が時間切れになりました。" };
  if (error instanceof TypeError)
    return {
      result: "cors_error" as const,
      detail: "ブラウザの通信制限により記事本文を直接取得できませんでした。"
    };
  return {
    result: "parse_error" as const,
    detail: error instanceof Error ? error.message : "記事本文を取得できませんでした。"
  };
}
