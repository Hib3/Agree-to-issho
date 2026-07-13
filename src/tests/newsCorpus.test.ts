import { describe, expect, it } from "vitest";
import { createUserConcept } from "../domain/learning/conceptFactory";
import type { ArticleDigest, NewsItem } from "../domain/model/news";
import { buildNewsConversationPlan } from "../domain/news/newsExplanation";

const topics = [
  ["駅", "交通局が三つの駅で案内表示を試す。"],
  ["宇宙", "研究所が宇宙観測の結果を公開した。"],
  ["音楽", "市民会館で音楽の催しを開く。"],
  ["市場", "市場で商品の価格が変化した。"],
  ["地震", "自治体が地震の被害を確認している。"]
] as const;

describe("100-news grounded corpus", () => {
  it("keeps every conversation bounded, sourced and sensitive-aware", () => {
    const concepts = topics.map(([word], index) => createUserConcept({ surface: word, category: "abstract" }, 1_700_000_000_000, `news-word-${index}`));
    const plans = Array.from({ length: 100 }, (_, index) => {
      const [word, summary] = topics[index % topics.length]!;
      const item: NewsItem = {
        id: `corpus_${index}`,
        feedId: "corpus_feed",
        sourceName: "検証通信",
        title: `${word}についての更新 ${index + 1}`,
        summary,
        url: `https://example.com/${index}`,
        publishedAt: 1_700_000_000_000 + index,
        fetchedAt: 1_700_000_000_000 + index
      };
      const sensitive = word === "地震";
      const digest: ArticleDigest = {
        newsItemId: item.id,
        contentLevel: index % 3 === 0 ? "headline_only" : "feed_summary",
        sourceUrl: item.url,
        extractedAt: item.fetchedAt,
        keyFacts: index % 3 === 0 ? [] : [{ id: `${item.id}_fact`, text: summary, evidenceId: `${item.id}_summary` }],
        keySentences: [{ id: `${item.id}_headline`, text: item.title, source: "headline" }, ...(index % 3 === 0 ? [] : [{ id: `${item.id}_summary`, text: summary, source: "feed_summary" as const }])],
        entities: [],
        topics: [{ key: word === "駅" ? "transport" : word === "宇宙" ? "science_technology" : "general", label: `${word}の話題` }],
        events: [],
        numericalFacts: [],
        uncertainties: ["記事全体の背景"],
        tone: sensitive ? "sensitive" : "neutral",
        confidence: index % 3 === 0 ? 0.25 : 0.5
      };
      return buildNewsConversationPlan(item, digest, concepts);
    });
    expect(plans).toHaveLength(100);
    for (const plan of plans) {
      expect(plan.pages.length).toBeGreaterThanOrEqual(3);
      expect(plan.pages.length).toBeLessThanOrEqual(6);
      expect(plan.pages.every((page) => Boolean(page.source) && Boolean(page.text))).toBe(true);
      expect(plan.pages.map((page) => page.text).join(" ")).not.toMatch(/(?:^|[。！？\s])(?:これ|それ|あれ)(?:は|が|を|に|で)/u);
      if (plan.pages.some((page) => page.text.includes("地震"))) {
        expect(plan.pages.every((page) => page.source !== "imagination")).toBe(true);
      }
    }
    expect(new Set(plans.map((plan) => plan.selectedLens)).size).toBeGreaterThanOrEqual(2);
  });
});
