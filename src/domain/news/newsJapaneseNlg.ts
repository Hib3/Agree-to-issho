import type { ArticleContentLevel, ArticleDigest, ArticleIssue, ArticleTone, NewsItem } from "../model/news";

export type NewsDiscourseFrame = {
  headline: string;
  topicKey: string;
  topicLabel: string;
  contentLevel: ArticleContentLevel;
  tone: ArticleTone;
  sensitive: boolean;
  focusLabel: string;
  safeNumber?: string | undefined;
  variant: number;
};

const issueQuestionFocus: Record<ArticleIssue["kind"], string> = {
  change: "何が変わるのか",
  cause: "なぜ起きたのか",
  effect: "どこへ影響するのか",
  benefit: "どんな利点があるのか",
  risk: "どんな心配があるのか",
  conflict: "意見が分かれている点",
  number: "数字が示す規模",
  person: "関わる人や組織",
  place: "関係する場所",
  uncertainty: "まだ分からない点"
};

export function buildNewsDiscourseFrame(
  item: NewsItem,
  digest: ArticleDigest,
  selectedIssues: ArticleIssue[]
): NewsDiscourseFrame {
  const topicLabel = safeLabel(digest.topics[0]?.label, "今回の出来事");
  const issue = selectedIssues[0];
  const safeNumber = digest.tone === "sensitive" ? undefined : selectComparableNumber(digest);
  return {
    headline: item.title,
    topicKey: digest.topics[0]?.key ?? "general",
    topicLabel,
    contentLevel: digest.contentLevel,
    tone: digest.tone,
    sensitive: digest.tone === "sensitive",
    focusLabel: issue ? issueQuestionFocus[issue.kind] : `${topicLabel}の要点`,
    ...(safeNumber ? { safeNumber } : {}),
    variant: stableHash(item.id) % 4
  };
}

export function realizeNewsOpening(frame: NewsDiscourseFrame) {
  const articleWord = frame.contentLevel === "headline_only" ? "見出し" : "記事";
  const headline = quoteHeadline(frame.headline);
  if (frame.sensitive)
    return `${headline}という${articleWord}が届いています。内容を軽く扱わず、落ち着いて読みます。`;
  const endings = [
    `まずは、${frame.focusLabel}を見てみます。`,
    `アグリは、${frame.focusLabel}を確かめたいです。`,
    `いちばん気になったのは、${frame.focusLabel}です。`,
    `${frame.focusLabel}に注目して読んでみます。`
  ];
  return `${headline}という${articleWord}が届いています。${endings[frame.variant]}`;
}

export function realizeNewsUnderstanding(frame: NewsDiscourseFrame, issue: ArticleIssue, index: number) {
  const source = sourcePhrase(frame.contentLevel);
  const nounPhrase = issueNounPhrase(frame.topicLabel, issue.kind, frame.topicKey);
  if (frame.sensitive) {
    const sensitiveFocus = issue.kind === "number" ? `${frame.topicLabel}に関わる具体的な情報` : nounPhrase;
    return `${source}${sensitiveFocus}が主な論点です。確認できた範囲だけを扱います。`;
  }
  if (issue.kind === "number" && frame.safeNumber)
    return `${source}「${frame.safeNumber}」という数字が確認できます。${numberContextQuestion(frame.safeNumber)}`;
  if (index === 0) return `${source}まず、${nounPhrase}が主な論点だと分かります。`;
  return `もう一つの論点は、${nounPhrase}です。`;
}

export function realizeNewsInterpretation(frame: NewsDiscourseFrame) {
  if (frame.contentLevel === "headline_only")
    return `見出しからは、${frame.topicLabel}に関わる話に見えます。ただし、起きたことの詳しい中身はまだ不明です。`;
  const variants = [
    `アグリは、まず${frame.topicLabel}に関わる話として受け取りました。記事にないことは足しません。`,
    `${frame.topicLabel}の話として整理すると分かりやすそうです。ここから先は、本文にある範囲で考えます。`,
    `今のところ、${frame.topicLabel}に関わる話として読んでいます。書かれていない理由は作りません。`,
    `${frame.topicLabel}の話として読むのが近そうです。事実とアグリの感想は分けておきます。`
  ];
  return variants[frame.variant] ?? variants[0]!;
}

export function realizeNewsOpinion(frame: NewsDiscourseFrame, issue?: ArticleIssue) {
  if (frame.sensitive)
    return `${frame.topicLabel}に関わる人を置き去りにしないよう、断定せずに読みたいです。アグリは、分からない所を想像で埋めません。`;
  if (issue?.kind === "benefit")
    return `便利になる可能性はうれしいです。でも、実際に誰へ届くのかまで確かめたいです。`;
  if (issue && ["risk", "conflict"].includes(issue.kind))
    return `気になる点が残っています。安心とも危険とも急いで決めず、続きの情報を待ちたいです。`;
  if (issue?.kind === "effect")
    return `暮らしへの影響がどこまで広がるのか気になります。身近な変化なのかを確かめたいです。`;
  if (frame.safeNumber) return numberOpinion(frame.safeNumber);
  if (frame.tone === "positive") return `よい変化に見えますが、始まった後も続くのか見ていたいです。`;
  if (frame.tone === "negative")
    return `困る人がいるなら、何が必要なのかを先に知りたいです。大きな言葉だけで済ませたくありません。`;
  return topicOpinion(frame.topicKey, frame.topicLabel);
}

export function realizeNewsUncertainty(frame: NewsDiscourseFrame) {
  if (frame.contentLevel === "headline_only")
    return `今読めたのは見出しだけです。理由や結果は、本文を読めるまで決めません。`;
  if (frame.contentLevel === "feed_summary")
    return `今読めたのはRSSの短い説明までです。省かれた経緯があるかもしれないので、断定はしません。`;
  if (frame.contentLevel === "feed_content")
    return `RSSに入っている本文は読めましたが、記事全体の経緯までは分かりません。`;
  return `本文の一部は読めました。ただ、記事だけでは分からない背景もあるので、断定せずに話します。`;
}

export function realizeNewsImagination(frame: NewsDiscourseFrame) {
  const ideas: Record<string, string> = {
    transport: "もし新しい仕組みを駅で見かけたら、アグリは案内板を二度見してから歩き出しそうです。",
    science_technology: "新しい技術が部屋に来たら、まずノート整理を手伝えるか試してみたいです。",
    economy: "値札に変化が出たら、一度通り過ぎたあとで、そっと戻って確かめそうです。",
    culture: "気になる催しなら、予定をノートへ書いた時点で少し楽しみになりそうです。",
    sports: "記録の話を聞くと、アグリも小さな目標を一つ決めたくなります。",
    health: "暮らしに関わる話なら、無理をしない方法から確かめたいです。",
    lifestyle_product: "暮らしの道具なら、部屋で本当に使う場面を思い浮かべてから選びたいです。",
    weather_safety: "天気の変化なら、出かける前に窓と持ち物をもう一度確かめたいです。"
  };
  return `ここからはアグリの想像です。${ideas[frame.topicKey] ?? "この話が身近になったら、ノートに気づいたことを書いておきたいです。"}`;
}

export function newsResponseSubject(digest: ArticleDigest, issue?: ArticleIssue) {
  const topic = safeLabel(digest.topics[0]?.label, "今回の話");
  return issue
    ? issueNounPhrase(topic, issue.kind, digest.topics[0]?.key ?? "general")
    : `${topic}の受け取り方`;
}

export function newsUncertaintySubject(contentLevel: ArticleContentLevel) {
  return {
    headline_only: "見出しに含まれない経緯",
    feed_summary: "短い説明では省かれている経緯",
    feed_content: "RSS本文だけでは分からない背景",
    article_extract: "記事だけでは分からない背景"
  }[contentLevel];
}

export function validateNewsJapanese(text: string) {
  const problems: string[] = [];
  if (
    /undefined|null|\[object Object\]|Markdown Content:|URL Source:|取得できた本文の一部だけが使えています/iu.test(
      text
    )
  )
    problems.push("artifact");
  if (/(?:取得できた記事本文|RSS内の本文|RSSの短い説明).*「[^」]{40,}」/u.test(text))
    problems.push("source-copy");
  if (/[0-9０-９]{4}年に関わる人/u.test(text)) problems.push("date-as-person-topic");
  if (/世の中の出来事の動き|に関わる人の状況を/u.test(text)) problems.push("unnatural-frame");
  if (/(?:について|では?|から)(?:何が|なぜ|どこへ|どんな)[^。！？!?]{0,28}が(?:報じ|伝え)/u.test(text))
    problems.push("embedded-question-clause");
  if (/(?:がが|をを|にはは|ですです)/u.test(text)) problems.push("duplicate-particle");
  if (/。が(?:分かる|分から|気になる|知りたい)/u.test(text)) problems.push("broken-connective");
  const openQuotes = (text.match(/「/gu) ?? []).length;
  const closeQuotes = (text.match(/」/gu) ?? []).length;
  if (openQuotes !== closeQuotes) problems.push("unbalanced-quote");
  return problems;
}

function sourcePhrase(level: ArticleContentLevel) {
  return {
    headline_only: "見出しからは、",
    feed_summary: "RSSの短い説明からは、",
    feed_content: "RSSに含まれる本文からは、",
    article_extract: "取得できた本文からは、"
  }[level];
}

function issueNounPhrase(topic: string, kind: ArticleIssue["kind"], topicKey: string) {
  return {
    change: `${topic}をめぐる変化`,
    cause: `${topic}に関わる変化の理由`,
    effect: `${topic}が暮らしや社会へ及ぼす影響`,
    benefit: `${topic}から期待される利点`,
    risk: `${topic}に残る懸念`,
    conflict: `${topic}をめぐる意見の違い`,
    number: numberNounPhrase(topicKey, topic),
    person: `${topic}に関わる人や組織`,
    place: `${topic}に関係する場所`,
    uncertainty: `${topic}についてまだ分からない点`
  }[kind];
}

function numberNounPhrase(topicKey: string, topic: string) {
  return (
    {
      science_technology: "技術の性能を比べる条件",
      economy: "価格や割合を比べる条件",
      sports: "記録や成績を比べる条件",
      health: "健康への影響を比べる条件",
      transport: "利用規模を比べる条件",
      lifestyle_product: "使いやすさや容量を比べる条件"
    }[topicKey] ?? `${topic}に関する規模や比較条件`
  );
}

function topicOpinion(topicKey: string, topic: string) {
  return (
    {
      transport: "移動する人にとって、実際に何が便利になるのか知りたいです。",
      science_technology: "新しい技術が、実際の使い方をどう変えるのか確かめたいです。",
      economy: "値段や仕組みの変化が、日々の買い物へどう響くのか知りたいです。",
      culture: "見たり聞いたりする人に、どんな体験が届くのか気になります。",
      sports: "結果だけでなく、そこへ至るまでに何が変わったのか知りたいです。",
      health: "体や暮らしへの影響を、無理のない範囲で確かめたいです。",
      weather_safety: "自分のいる場所で何に備えればよいのか、具体的に知りたいです。",
      energy_environment: "暮らしへの影響と、安全をどう確かめるのかが気になります。",
      lifestyle_product: "実際に使う場面で、手間がどれくらい減るのか知りたいです。",
      society_politics: "制度の変化が、誰の生活をどう変えるのか確かめたいです。"
    }[topicKey] ?? `${topic}の話が身近になる場面を、もう少し知りたいです。`
  );
}

function numberContextQuestion(value: string) {
  if (/(?:％|%)$/u.test(value)) return "何を基準にした割合なのかも確かめたいです。";
  if (/(?:円|ドル)$/u.test(value)) return "元の金額や比較対象も確かめたいです。";
  if (/(?:人|件|社|台|冊|個|本)$/u.test(value)) return "対象の範囲や期間も確かめたいです。";
  return "何と比べる数字なのかも確かめたいです。";
}

function numberOpinion(value: string) {
  if (/(?:％|%)$/u.test(value))
    return `「${value}」は、何を基準にした割合かで意味が変わります。元の数値と比べて考えたいです。`;
  if (/(?:円|ドル)$/u.test(value))
    return `「${value}」という金額だけで高いか安いかは決めません。比較する品や時期も知りたいです。`;
  return `「${value}」だけでは規模を決められません。対象の範囲や期間も知りたいです。`;
}

function quoteHeadline(headline: string) {
  if (/[「」]/u.test(headline)) return `『${headline}』`;
  return `「${headline}」`;
}

function selectComparableNumber(digest: ArticleDigest) {
  return digest.numericalFacts
    .map((entry) => entry.value.trim())
    .find(
      (value) =>
        value.length <= 16 &&
        /(?:％|%|人|件|回|円|ドル|キロ|km|駅|社|か所|カ所|倍|割|台|冊|個|本)$/iu.test(value) &&
        !/(?:年|月|日|時|分|秒|歳)$/u.test(value) &&
        !/^(?:19|20)[0-9０-９]{2}$/u.test(value)
    );
}

function safeLabel(value: string | undefined, fallback: string) {
  const cleaned = value?.replace(/[「」『』【】]/gu, "").trim();
  return cleaned && Array.from(cleaned).length <= 24 ? cleaned : fallback;
}

function stableHash(value: string) {
  return Array.from(value).reduce((hash, character) => (hash * 31 + character.codePointAt(0)!) >>> 0, 7);
}
