import { describe, expect, it } from "vitest";
import { createUserConcept } from "../domain/learning/conceptFactory";
import type { NewsItem } from "../domain/model/news";
import { buildNewsExplanation } from "../domain/news/newsExplanation";

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
    expect(pages.join("\n")).toContain(item.title);
    expect(pages.join("\n")).toContain(item.summary);
    expect(pages.join("\n")).toContain("背景や真偽までは決められません");
    expect(pages.join("\n")).not.toMatch(/undefined|null|まァっ、/u);
  });

  it("connects only a learned word that actually appears in the feed text", () => {
    const space = createUserConcept({ surface: "宇宙", category: "abstract" }, item.fetchedAt, "space");
    const unrelated = createUserConcept({ surface: "カレー", category: "food_drink" }, item.fetchedAt, "curry");
    const transcript = buildNewsExplanation(item, [space, unrelated]).join("\n");
    expect(transcript).toContain("教えてもらった「宇宙」");
    expect(transcript).not.toContain("教えてもらった「カレー」");
  });
});
