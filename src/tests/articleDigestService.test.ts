import { afterEach, describe, expect, it, vi } from "vitest";
import type { NewsItem } from "../domain/model/news";
import { buildFeedDigest, fetchArticleDigest } from "../infrastructure/news/articleDigestService";

const now = 1_700_000_000_000;
const item: NewsItem = {
  id: "news_article",
  feedId: "feed_article",
  sourceName: "町の通信",
  title: "三つの駅で案内表示を試験",
  summary: "交通局は三つの駅で新しい案内表示を試すと発表した。",
  url: "https://example.com/article",
  publishedAt: now,
  fetchedAt: now
};

afterEach(() => vi.unstubAllGlobals());

describe("article digest service", () => {
  it("keeps a compact feed digest without fetching", () => {
    const digest = buildFeedDigest(item, now);
    expect(digest.contentLevel).toBe("feed_summary");
    expect(digest.keyFacts[0]?.text).toBe(item.summary);
    expect(digest.confidence).toBeLessThan(0.6);
  });

  it("extracts article paragraphs while excluding navigation and advertisements", async () => {
    const html = `<html><body><nav>メニューの説明がここに長く並んでいます。</nav><article><h1>${item.title}</h1><p>交通局は三つの駅で新しい案内表示を試すと発表しました。</p><p>試験は七月から始まり、利用者の反応を確認します。</p><div class="advertisement"><p>広告の商品説明は根拠にしてはいけません。</p></div></article></body></html>`;
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(html, { status: 200, headers: { "content-type": "text/html" } })));
    const digest = await fetchArticleDigest(item, { useArticleHelper: false, now });
    expect(digest.contentLevel).toBe("article_extract");
    expect(digest.keyFacts.map((fact) => fact.text).join(" ")).toContain("七月");
    expect(digest.keyFacts.map((fact) => fact.text).join(" ")).not.toContain("広告");
    expect(digest.numericalFacts.some((fact) => fact.value.includes("三つ"))).toBe(false);
  });

  it("contacts the article helper only after direct failure and explicit consent", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("CORS"))
      .mockResolvedValueOnce(new Response(`Title: 記事\nMarkdown Content:\n## 本文\n交通局は三つの駅で案内表示を試験します。利用者の反応を七月から確認する予定です。\n新しい表示は日本語と英語に対応し、迷いやすい場所から順番に設置されます。`, { status: 200, headers: { "content-type": "text/plain" } }));
    vi.stubGlobal("fetch", fetchMock);
    const digest = await fetchArticleDigest(item, { useArticleHelper: true, now });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`https://r.jina.ai/${item.url}`);
    expect(digest.contentLevel).toBe("article_extract");
  });

  it("does not send the article URL to a helper without article consent", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("CORS"));
    vi.stubGlobal("fetch", fetchMock);
    const digest = await fetchArticleDigest(item, { useArticleHelper: false, now });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(digest.contentLevel).toBe("feed_summary");
    expect(digest.uncertainties.join(" ")).toContain("直接取得できませんでした");
  });

  it("falls back without retaining an oversized article", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("large", { status: 200, headers: { "content-length": "1000001" } })));
    const digest = await fetchArticleDigest(item, { useArticleHelper: false, now });
    expect(digest.contentLevel).toBe("feed_summary");
    expect(JSON.stringify(digest).length).toBeLessThan(10_000);
  });
});
