import type {
  ArticleContentLevel,
  ArticleDigest,
  ArticleEvidence,
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
  const contentLevel: ArticleContentLevel = item.feedContent
    ? "feed_content"
    : item.summary
      ? "feed_summary"
      : "headline_only";
  const evidence: ArticleEvidence[] = [{ id: `${item.id}_headline`, text: item.title, source: "headline" }];
  if (item.summary) evidence.push({ id: `${item.id}_summary`, text: item.summary, source: "feed_summary" });
  if (item.feedContent)
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
  options: { useArticleHelper: boolean; signal?: AbortSignal | undefined; now?: number | undefined }
): Promise<ArticleDigest> {
  const now = options.now ?? Date.now();
  const fallback = buildFeedDigest(item, now);
  let directFailure = "";
  try {
    const response = await fetchArticleText(
      item.url,
      "text/html, application/xhtml+xml, text/plain",
      options.signal
    );
    const text = extractArticleText(response.text, response.contentType);
    if (text.length >= 40) return digestFromArticle(item, text, response.finalUrl, now);
    directFailure = "記事本文から十分な文章を取り出せませんでした。";
  } catch (error) {
    if (options.signal?.aborted) throw error;
    directFailure = userArticleFailure(error);
  }

  if (options.useArticleHelper) {
    try {
      const response = await fetchArticleText(`${READER_ENDPOINT}${item.url}`, "text/plain", options.signal);
      const text = extractReaderText(response.text);
      if (text.length >= 40) return digestFromArticle(item, text, item.url, now);
      directFailure = "取得補助から十分な文章を取り出せませんでした。";
    } catch (error) {
      if (options.signal?.aborted) throw error;
      directFailure = "記事本文を直接にも取得補助からも読めませんでした。";
    }
  }

  return { ...fallback, uncertainties: [...fallback.uncertainties, directFailure].filter(Boolean) };
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
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new Error("公開されたHTTPSの記事だけ取得できます。");
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
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_ARTICLE_BYTES) throw new Error("記事が大きすぎます。");
    const text = await readArticleBody(response, controller);
    return {
      text,
      finalUrl: response.url || parsed.href,
      contentType: response.headers.get("content-type") ?? ""
    };
  } finally {
    globalThis.clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onAbort);
  }
}

async function readArticleBody(response: Response, controller: AbortController) {
  if (!response.body) {
    const text = await response.text();
    if (new Blob([text]).size > MAX_ARTICLE_BYTES) throw new Error("記事が大きすぎます。");
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
      throw new Error("記事が大きすぎます。");
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

function userArticleFailure(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError")
    return "記事の取得が時間切れになりました。";
  if (error instanceof TypeError) return "ブラウザから記事本文を直接取得できませんでした。";
  return error instanceof Error ? error.message : "記事本文を取得できませんでした。";
}
