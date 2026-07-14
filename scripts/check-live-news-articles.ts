import { JSDOM } from "jsdom";
import { fetchArticleDigest } from "../src/infrastructure/news/articleDigestService";
import { parseRssXml } from "../src/domain/news/rssParser";
import { buildNewsConversationPlan } from "../src/domain/news/newsExplanation";
import { validateNewsJapanese } from "../src/domain/news/newsJapaneseNlg";

const feeds = {
  yahoo: "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
  gigazine: "https://gigazine.net/news/rss_2.0/",
  lifehacker: "https://www.lifehacker.jp/feed/index.xml"
};

const dom = new JSDOM();
Object.defineProperty(globalThis, "DOMParser", { value: dom.window.DOMParser, configurable: true });

const results = [];
const failures: string[] = [];
for (const [name, feedUrl] of Object.entries(feeds)) {
  const feedResponse = await fetch(feedUrl, { headers: { Accept: "application/rss+xml, application/xml" } });
  if (!feedResponse.ok) throw new Error(`${name}: RSS HTTP ${feedResponse.status}`);
  const parsed = parseRssXml(await feedResponse.text(), `live_${name}`, feedUrl);
  const item = parsed.items[0];
  if (!item) throw new Error(`${name}: RSSに記事がありません。`);
  const fetched = await fetchArticleDigest(item, {
    useArticleHelper: true,
    attemptDirect: false
  });
  const facts = fetched.digest.keyFacts.map((fact) => fact.text);
  const joined = facts.join(" ");
  const plan = buildNewsConversationPlan(item, fetched.digest, [], { now: item.fetchedAt });
  const conversation = plan.pages.map((page) => page.text).join("\n");
  const japaneseProblems = validateNewsJapanese(conversation);
  const copiedFact = facts.some((fact) => fact.length >= 40 && conversation.includes(fact));
  const hasArtifact =
    /(?:https?:\/\/|Markdown Content:|URL Source:|\[object Object\]|(?:^|\s)undefined(?:\s|$))/iu.test(
      joined
    );
  results.push({
    name,
    title: item.title,
    articleUrl: item.url,
    contentLevel: fetched.digest.contentLevel,
    sourceUrl: fetched.digest.sourceUrl,
    factCount: facts.length,
    factPreview: facts.map((fact) => Array.from(fact).slice(0, 90).join("")),
    helperAttempts: fetched.trace.attempts.filter((attempt) => attempt.method === "reader_helper"),
    hasArtifact,
    conversationPages: plan.pages.length,
    conversationPreview: plan.pages.map((page) => page.text.slice(0, 100)),
    japaneseProblems,
    copiedFact
  });
  if (fetched.digest.contentLevel !== "article_extract")
    failures.push(`${name}: 記事本文を取得できませんでした。`);
  if (facts.length === 0) failures.push(`${name}: 会話へ渡せる根拠文がありません。`);
  if (hasArtifact) failures.push(`${name}: 根拠文に内部文字列またはURLが混入しました。`);
  if (japaneseProblems.length > 0)
    failures.push(`${name}: 生成会話に日本語検証エラーがあります (${japaneseProblems.join(",")})。`);
  if (copiedFact) failures.push(`${name}: 記事本文を会話へ丸写ししています。`);
}

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
if (failures.length > 0) throw new Error(failures.join("\n"));
