import { describe, expect, it } from "vitest";
import type {
  ArticleContentLevel,
  ArticleDigest,
  ArticleIssue,
  ArticleTone,
  NewsItem
} from "../domain/model/news";
import { buildNewsConversationPlan } from "../domain/news/newsExplanation";
import { validateNewsJapanese } from "../domain/news/newsJapaneseNlg";

const topicCases = [
  ["transport", "交通", "駅の案内表示"],
  ["science_technology", "科学と技術", "観測装置"],
  ["economy", "経済", "地域の価格"],
  ["culture", "文化", "週末の展示"],
  ["sports", "スポーツ", "大会の記録"],
  ["health", "健康", "健康相談"],
  ["weather_safety", "天気と安全", "大雨への備え"],
  ["society_politics", "社会と政治", "市の新制度"],
  ["education", "教育", "学校の授業"],
  ["general", "地域の出来事", "図書館の予定"]
] as const;
const issueKinds: ArticleIssue["kind"][] = [
  "change",
  "cause",
  "effect",
  "benefit",
  "risk",
  "conflict",
  "number",
  "person",
  "place",
  "uncertainty"
];
const contentLevels: ArticleContentLevel[] = [
  "headline_only",
  "feed_summary",
  "feed_content",
  "article_extract"
];
const tones: ArticleTone[] = ["neutral", "positive", "negative", "sensitive", "mixed", "unknown"];

describe("600-viewpoint Japanese news generation", () => {
  it("produces 600 distinct grounded conversations without source-copy or malformed frames", () => {
    const transcripts = new Set<string>();
    const scenarioKeys = new Set<string>();
    const coveredKinds = new Set<string>();
    const coveredLevels = new Set<string>();
    const coveredTones = new Set<string>();

    for (let index = 0; index < 600; index += 1) {
      const topic = topicCases[index % topicCases.length]!;
      const kind = issueKinds[Math.floor(index / topicCases.length) % issueKinds.length]!;
      const level = contentLevels[Math.floor(index / 100) % contentLevels.length]!;
      const tone = tones[Math.floor(index / 100) % tones.length]!;
      const scenarioKey = `${topic[0]}:${kind}:${level}:${tone}:${index}`;
      const rawMarker = `RAW_SOURCE_MARKER_${index}`;
      const internalMarker = `INTERNAL_UNCERTAINTY_${index}`;
      const item: NewsItem = {
        id: `nlg_case_${index}`,
        feedId: "nlg_matrix",
        sourceName: "検証通信",
        title: `${topic[2]}について${issueLabel(kind)}を伝える記事 ${index + 1}`,
        summary: level === "headline_only" ? "" : `${rawMarker}を含む抽出原文です。`,
        url: `https://example.test/news/${index}`,
        publishedAt: 1_700_000_000_000 + index,
        fetchedAt: 1_700_000_000_000 + index
      };
      const digest = makeDigest(item, level, tone, kind, topic[0], topic[1], rawMarker, internalMarker);
      const plan = buildNewsConversationPlan(item, digest, [], { now: item.fetchedAt });
      const transcript = plan.pages.map((page) => page.text).join("\n");

      scenarioKeys.add(scenarioKey);
      transcripts.add(transcript);
      coveredKinds.add(kind);
      coveredLevels.add(level);
      coveredTones.add(tone);

      expect(plan.pages.length).toBeGreaterThanOrEqual(3);
      expect(plan.pages.length).toBeLessThanOrEqual(6);
      expect(plan.pages.every((page) => page.text.length > 0 && page.evidenceIds !== undefined)).toBe(true);
      expect(validateNewsJapanese(transcript)).toEqual([]);
      expect(transcript).not.toContain(rawMarker);
      expect(transcript).not.toContain(internalMarker);
      expect(transcript).not.toContain("2009年に関わる人");
      expect(transcript).not.toMatch(/取得できた記事本文では、「|RSS内の本文では、「/u);
      if (tone === "sensitive") expect(plan.pages.some((page) => page.source === "imagination")).toBe(false);
    }

    expect(scenarioKeys.size).toBe(600);
    expect(transcripts.size).toBe(600);
    expect(coveredKinds.size).toBe(10);
    expect(coveredLevels.size).toBe(4);
    expect(coveredTones.size).toBe(6);
  });

  it("rejects the three malformed patterns observed in screenshots", () => {
    expect(validateNewsJapanese("2009年に関わる人の状況を読みたいです。")).toContain("date-as-person-topic");
    expect(validateNewsJapanese("取得できた記事本文では、「長い原文" + "です".repeat(30) + "」")).toContain(
      "source-copy"
    );
    expect(validateNewsJapanese("[object Object] undefined")).toContain("artifact");
    expect(
      validateNewsJapanese(
        "取得できた本文の一部だけが使えています。記事全体の文脈は元記事で確認が必要です。が分かる情報"
      )
    ).toEqual(expect.arrayContaining(["artifact", "broken-connective"]));
  });
});

function makeDigest(
  item: NewsItem,
  contentLevel: ArticleContentLevel,
  tone: ArticleTone,
  kind: ArticleIssue["kind"],
  topicKey: string,
  topicLabel: string,
  rawMarker: string,
  internalMarker: string
): ArticleDigest {
  const hasBody = contentLevel !== "headline_only";
  const issue: ArticleIssue = {
    id: `${item.id}_issue`,
    label: issueLabel(kind),
    summary: `${rawMarker}についての長い原文をそのまま表示してはいけません。`,
    evidenceIds: hasBody ? [`${item.id}_fact`, `${item.id}_evidence`] : [],
    kind,
    importance: 0.7,
    relevanceToUser: 0.6,
    suitabilityForOpinion: 0.65
  };
  return {
    newsItemId: item.id,
    contentLevel,
    sourceUrl: item.url,
    extractedAt: item.fetchedAt,
    keyFacts: hasBody
      ? [{ id: `${item.id}_fact`, text: issue.summary, evidenceId: `${item.id}_evidence` }]
      : [],
    keySentences: [
      { id: `${item.id}_headline`, text: item.title, source: "headline" },
      ...(hasBody
        ? [
            {
              id: `${item.id}_evidence`,
              text: issue.summary,
              source: contentLevel === "article_extract" ? ("article" as const) : ("feed_summary" as const)
            }
          ]
        : [])
    ],
    entities: [{ name: "2009年", kind: "other" }],
    topics: [{ key: topicKey, label: topicLabel }],
    events: [],
    numericalFacts: [{ value: "2009年", context: issue.summary, evidenceId: `${item.id}_evidence` }],
    issues: hasBody ? [issue] : [],
    uncertainties: [internalMarker],
    tone,
    confidence: contentLevel === "article_extract" ? 0.78 : contentLevel === "headline_only" ? 0.25 : 0.5
  };
}

function issueLabel(kind: ArticleIssue["kind"]) {
  return {
    change: "変化",
    cause: "理由",
    effect: "影響",
    benefit: "利点",
    risk: "懸念",
    conflict: "意見の違い",
    number: "数字",
    person: "関係者",
    place: "場所",
    uncertainty: "不明点"
  }[kind];
}
