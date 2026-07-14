import { describe, expect, it } from "vitest";
import { createUserConcept } from "../domain/learning/conceptFactory";
import type { ArticleDigest, NewsItem } from "../domain/model/news";
import { buildFeedDigest } from "../infrastructure/news/articleDigestService";
import {
  buildNewsConversationPlan,
  buildNewsExplanation,
  findNewsConcepts
} from "../domain/news/newsExplanation";

const item: NewsItem = {
  id: "news_test",
  feedId: "feed_test",
  sourceName: "科学便り",
  title: "宇宙観測の新しい結果",
  summary: "研究チームが観測結果を公開した。",
  url: "https://example.com/space",
  publishedAt: 1_700_000_000_000,
  fetchedAt: 1_700_000_000_000
};

describe("grounded news explanation", () => {
  it("limits claims to feed fields and states what remains unknown", () => {
    const pages = buildNewsExplanation(item, []);
    const transcript = pages.join("\n");
    expect(transcript).toContain(item.title);
    expect(transcript).toContain("科学と技術");
    expect(transcript).toMatch(/RSSの短い説明|配信された要約/u);
    expect(transcript).not.toContain(`「${item.summary}」`);
    expect(transcript).not.toMatch(/undefined|null|まァっ、|記事全体の背景/u);
  });

  it("connects only a learned word that actually appears in the feed text", () => {
    const space = createUserConcept({ surface: "宇宙", category: "abstract" }, item.fetchedAt, "space");
    const unrelated = createUserConcept(
      { surface: "カレー", category: "food_drink" },
      item.fetchedAt,
      "curry"
    );
    const transcript = buildNewsExplanation(item, [space, unrelated]).join("\n");
    expect(transcript).toContain("教えてもらった「宇宙」");
    expect(transcript).not.toContain("教えてもらった「カレー」");
  });

  it("does not match short words inside unrelated compounds", () => {
    const ai = createUserConcept({ surface: "AI", category: "abstract" }, item.fetchedAt, "ai");
    const bread = createUserConcept({ surface: "パン", category: "food_drink" }, item.fetchedAt, "bread");
    const rice = createUserConcept({ surface: "米", category: "food_drink" }, item.fetchedAt, "rice");
    const compoundItem = { ...item, title: "RAIL計画とパンデミック対策を米国が発表", summary: "" };
    const matches = findNewsConcepts(compoundItem, buildFeedDigest(compoundItem, item.fetchedAt), [
      ai,
      bread,
      rice
    ]);
    expect(matches).toEqual([]);
  });

  it("keeps user preference separate from Aguri opinion", () => {
    const space = {
      ...createUserConcept({ surface: "宇宙", category: "abstract" }, item.fetchedAt, "space-opinion"),
      preference: 2 as const
    };
    const plan = buildNewsConversationPlan(item, buildFeedDigest(item, item.fetchedAt), [space]);
    expect(plan.opinions.some((opinion) => opinion.owner === "user" && opinion.polarity === 1)).toBe(true);
    expect(
      plan.opinions.some((opinion) => opinion.owner === "aguri" && opinion.id !== plan.opinions[0]?.id)
    ).toBe(true);
  });

  it("uses calm grounded beats and no imagination for sensitive news", () => {
    const sensitive = {
      ...item,
      id: "news_sensitive",
      title: "地震で交通に被害",
      summary: "自治体が被害状況を確認している。"
    };
    const plan = buildNewsConversationPlan(sensitive, buildFeedDigest(sensitive, item.fetchedAt), []);
    expect(plan.pages.length).toBeGreaterThanOrEqual(3);
    expect(plan.pages.length).toBeLessThanOrEqual(6);
    expect(plan.pages.every((page) => page.source !== "imagination")).toBe(true);
    expect(plan.pages.map((page) => page.text).join(" ")).not.toMatch(/わくわく|ギャグ|すごい/u);
    expect(plan.emotionCurve).not.toContain("excited");
  });

  it("does not present a truncated headline copy as a separate fact", () => {
    const technical = {
      ...item,
      id: "news_technical",
      title: "feat: add punchline story arcs and integrate character staging",
      summary: "feat: add punchline story arcs and integra"
    };
    const digest = buildFeedDigest(technical, item.fetchedAt);
    const plan = buildNewsConversationPlan(technical, digest, []);

    expect(digest.keyFacts).toEqual([]);
    expect(plan.openingReaction.text).toContain("まだ分からない点");
    expect(plan.openingReaction.text).not.toContain(
      "「feat: add punchline story arcs and integra」という変化"
    );
    expect(plan.understanding[0]?.source).toBe("headline");
  });

  it("does not repeat two issues that have the same discourse role", () => {
    const digest: ArticleDigest = {
      ...buildFeedDigest(item, item.fetchedAt),
      contentLevel: "article_extract",
      issues: [
        {
          id: "change_one",
          label: "一つ目の変化",
          summary: "最初の機能が公開された。",
          evidenceIds: ["fact_one"],
          kind: "change",
          importance: 0.9,
          relevanceToUser: 0.8,
          suitabilityForOpinion: 0.8
        },
        {
          id: "change_two",
          label: "二つ目の変化",
          summary: "別の機能も公開された。",
          evidenceIds: ["fact_two"],
          kind: "change",
          importance: 0.85,
          relevanceToUser: 0.75,
          suitabilityForOpinion: 0.75
        },
        {
          id: "risk_one",
          label: "心配な点",
          summary: "利用時の記録方法には確認が必要だ。",
          evidenceIds: ["fact_three"],
          kind: "risk",
          importance: 0.7,
          relevanceToUser: 0.7,
          suitabilityForOpinion: 0.8
        }
      ]
    };
    const plan = buildNewsConversationPlan(item, digest, []);

    expect(plan.selectedIssueIds).toHaveLength(2);
    expect(plan.selectedIssueIds).toContain("risk_one");
    expect(plan.understanding[0]?.text).not.toBe(plan.understanding[1]?.text);
  });
});
