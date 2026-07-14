import { createUserConcept } from "../src/domain/learning/conceptFactory";
import type { ArticleContentLevel, ArticleDigest, NewsItem } from "../src/domain/model/news";
import { buildNewsConversationPlan } from "../src/domain/news/newsExplanation";
import { validateNewsJapanese } from "../src/domain/news/newsJapaneseNlg";

const now = 1_700_000_000_000;
const sampleCount = 600;
const generalTopics = [
  ["宇宙", "研究所が宇宙観測の結果を公開した。", "science_technology", "科学と技術"],
  ["AI", "企業がAIを使った案内機能を三つの駅で試す。", "science_technology", "科学と技術"],
  ["市場", "市場で商品の価格が前月から変化した。", "economy", "経済"],
  ["電車", "交通局が新しい案内表示を七月から試す。", "transport", "交通"],
  ["音楽", "市民会館で音楽の催しを週末に開く。", "culture", "文化"],
  ["食品", "地域の店が新しい食品を販売する。", "general", "地域"],
  ["スポーツ", "選手が大会で新しい記録を達成した。", "sports", "スポーツ"],
  ["天気", "週末は気温が上がる見込みだと発表した。", "weather_safety", "天気"],
  ["図書館", "地域の図書館が開館時間を延長する。", "general", "地域"]
] as const;
const sensitiveTopics = [
  ["地震", "自治体が地震の被害状況を確認している。", "weather_safety", "災害"],
  ["医療", "医療機関が感染状況を調査している。", "health", "医療"],
  ["選挙", "選挙管理委員会が投票日程を発表した。", "society_politics", "政治"],
  ["事故", "交通機関が事故の影響を確認している。", "transport", "事故"],
  ["犯罪", "警察が事件の経緯を調べている。", "society_politics", "犯罪"]
] as const;
const concepts = [...generalTopics, ...sensitiveTopics]
  .filter((_, index) => index % 3 === 0)
  .map(([word], index) =>
    createUserConcept({ surface: word, category: "abstract" }, now, `simulation-news-${index}`)
  );
const contentLevelCounts: Record<string, number> = {};
const lensCounts: Record<string, number> = {};
const sourceCounts: Record<string, number> = {};
const transcripts = new Set<string>();
const failures: string[] = [];
let memoryConnections = 0;
let opinionUses = 0;
let sensitiveImagination = 0;
let headlineBodyClaims = 0;
let genericInterest = 0;
let sourceLinkPrompt = 0;

for (let index = 0; index < sampleCount; index += 1) {
  const sensitive = index % 4 === 3;
  const [word, summary, topicKey, topicLabel] = sensitive
    ? sensitiveTopics[index % sensitiveTopics.length]!
    : generalTopics[index % generalTopics.length]!;
  const contentLevels: ArticleContentLevel[] = [
    "headline_only",
    "feed_summary",
    "feed_content",
    "article_extract"
  ];
  const contentLevel = contentLevels[index % contentLevels.length]!;
  const rawMarker = `RAW_NEWS_SOURCE_${index}`;
  const internalMarker = `INTERNAL_FETCH_NOTE_${index}`;
  const item: NewsItem = {
    id: `news_sim_${index}`,
    feedId: "news_sim_feed",
    sourceName: "固定検証通信",
    title: `${word}についての更新 ${index + 1}`,
    summary: contentLevel === "headline_only" ? "" : `${summary}${rawMarker}`,
    url: `https://example.com/news/${index}`,
    publishedAt: now + index,
    fetchedAt: now + index
  };
  const digest: ArticleDigest = {
    newsItemId: item.id,
    contentLevel,
    sourceUrl: item.url,
    extractedAt: item.fetchedAt,
    keyFacts:
      contentLevel === "headline_only"
        ? []
        : [{ id: `${item.id}_fact`, text: `${summary}${rawMarker}`, evidenceId: `${item.id}_detail` }],
    keySentences: [
      { id: `${item.id}_headline`, text: item.title, source: "headline" },
      ...(contentLevel === "headline_only"
        ? []
        : [
            {
              id: `${item.id}_detail`,
              text: `${summary}${rawMarker}`,
              source:
                contentLevel === "article_extract"
                  ? ("article" as const)
                  : contentLevel === "feed_content"
                    ? ("feed_content" as const)
                    : ("feed_summary" as const)
            }
          ])
    ],
    entities: [],
    topics: [{ key: topicKey, label: topicLabel }],
    events: [],
    numericalFacts: [],
    issues:
      contentLevel === "headline_only"
        ? []
        : [
            {
              id: `${item.id}_issue`,
              label: "記事の要点",
              summary: `${summary}${rawMarker}`,
              evidenceIds: [`${item.id}_fact`, `${item.id}_detail`],
              kind: "change",
              importance: 0.7,
              relevanceToUser: 0.5,
              suitabilityForOpinion: 0.6
            }
          ],
    uncertainties: [internalMarker],
    tone: sensitive ? "sensitive" : "neutral",
    confidence: contentLevel === "headline_only" ? 0.25 : contentLevel === "feed_summary" ? 0.5 : 0.78
  };
  const plan = buildNewsConversationPlan(item, digest, concepts, { now: item.fetchedAt });
  const transcript = plan.pages.map((page) => page.text).join("\n");
  transcripts.add(transcript);
  contentLevelCounts[plan.contentLevel] = (contentLevelCounts[plan.contentLevel] ?? 0) + 1;
  lensCounts[plan.selectedLens] = (lensCounts[plan.selectedLens] ?? 0) + 1;
  for (const page of plan.pages) sourceCounts[page.source] = (sourceCounts[page.source] ?? 0) + 1;
  if (plan.memoryConnection) memoryConnections += 1;
  if (plan.opinions.some((opinion) => opinion.owner === "aguri")) opinionUses += 1;
  if (sensitive && plan.pages.some((page) => page.source === "imagination")) sensitiveImagination += 1;
  if (contentLevel === "headline_only" && /記事本文では|本文によると|本文を読むと/u.test(transcript))
    headlineBodyClaims += 1;
  genericInterest += (transcript.match(/気になります/gu) ?? []).length;
  sourceLinkPrompt += (transcript.match(/元の記事/gu) ?? []).length;
  if (plan.pages.length < 3 || plan.pages.length > 6) failures.push(`${index}:page-count`);
  if (plan.pages.some((page) => !page.source || !page.text)) failures.push(`${index}:missing-grounding`);
  if (/undefined|null|\[object Object\]/u.test(transcript)) failures.push(`${index}:artifact`);
  if (transcript.includes(rawMarker)) failures.push(`${index}:source-copy`);
  if (transcript.includes(internalMarker)) failures.push(`${index}:internal-note`);
  for (const problem of validateNewsJapanese(transcript)) failures.push(`${index}:japanese-${problem}`);
}

if (sensitiveImagination > 0) failures.push(`sensitive-imagination:${sensitiveImagination}`);
if (headlineBodyClaims > 0) failures.push(`headline-body-claims:${headlineBodyClaims}`);
if (transcripts.size !== sampleCount)
  failures.push(`duplicate-transcripts:${sampleCount - transcripts.size}`);
if (failures.length > 0) throw new Error(`news simulation failed: ${failures.slice(0, 20).join(" | ")}`);

console.log(
  JSON.stringify(
    {
      samples: sampleCount,
      generalSamples: sampleCount * 0.75,
      sensitiveSamples: sampleCount * 0.25,
      uniqueTranscripts: transcripts.size,
      completeDuplicateRate: 1 - transcripts.size / sampleCount,
      contentLevelCounts,
      lensCounts,
      sourceCounts,
      memoryConnectionRate: memoryConnections / sampleCount,
      characterOpinionRate: opinionUses / sampleCount,
      sensitiveImagination,
      headlineBodyClaims,
      genericInterestRate: genericInterest / sampleCount,
      sourceLinkPromptRate: sourceLinkPrompt / sampleCount
    },
    null,
    2
  )
);
