import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../domain/settings/gameSettings";
import { db } from "../infrastructure/db/database";
import { createNewsFeed, discoverNewsFeed, discoverNewsFeeds, extractFeedLinks, refreshNews, removeNewsFeed } from "../infrastructure/news/newsService";

const now = 1_700_000_000_000;

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  db.close();
  await db.delete();
});

describe("news refresh service", () => {
  it("rejects private-network feed addresses", () => {
    expect(() => createNewsFeed("http://example.com/feed")).toThrow("HTTPS");
    expect(() => createNewsFeed("https://localhost/feed")).toThrow("家庭内ネットワーク");
    expect(() => createNewsFeed("https://172.16.0.2/feed")).toThrow("家庭内ネットワーク");
  });

  it("uses the opt-in RSS JSON helper only after direct fetch fails", async () => {
    const feed = createNewsFeed("https://news.example.test/feed.xml", now);
    const settings = {
      ...createDefaultSettings(now),
      newsEnabled: true,
      newsUseFeedFetchHelper: true,
      newsFeeds: [feed]
    };
    await db.settings.put(settings);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("CORS"))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: "ok",
        feed: { title: "町の通信" },
        items: [{ guid: "one", title: "駅前の更新", link: "https://news.example.test/one", description: "短い説明。", pubDate: "2026-07-13 09:00:00" }]
      }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const report = await refreshNews(settings, now + 1, true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toEqual(expect.stringContaining("api.rss2json.com"));
    expect(report).toMatchObject({ successfulFeeds: 1, addedItems: 1, errors: [] });
    expect((await db.newsItems.toArray())[0]?.title).toBe("駅前の更新");
  });

  it("accepts a directly readable RSS document", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(
      `<?xml version="1.0"?><rss version="2.0"><channel><title>直接読める通信</title><item><guid>one</guid><title>更新</title><link>https://example.com/one</link></item></channel></rss>`,
      { status: 200, headers: { "content-type": "application/rss+xml" } }
    )));

    const feed = await discoverNewsFeed("https://example.com/news.xml", false, now);
    expect(feed).toMatchObject({ url: "https://example.com/news.xml", name: "直接読める通信" });
  });

  it("discovers an RSS URL from an HTML alternate link", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(
      `<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>`,
      { status: 200, headers: { "content-type": "text/html" } }
    )));

    const feed = await discoverNewsFeed("https://example.com/articles", false, now);
    expect(feed.url).toBe("https://example.com/feed.xml");
  });

  it("uses Feedsearch for site discovery only when the helper is enabled", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("CORS"))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { url: "https://example.com/feed.xml", title: "見つけた通信", score: 10 }
      ]), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>見つけた通信</title><item><title>確認用記事</title><link>https://example.com/one</link></item></channel></rss>`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const feed = await discoverNewsFeed("https://example.com/", true, now);
    expect(fetchMock.mock.calls[1]?.[0]).toEqual(expect.stringContaining("feedsearch.dev"));
    expect(feed).toMatchObject({ url: "https://example.com/feed.xml", name: "見つけた通信" });
  });

  it("does not send an obvious RSS URL to Feedsearch after a CORS failure", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("CORS"));
    vi.stubGlobal("fetch", fetchMock);

    const feed = await discoverNewsFeed("https://example.com/feed.xml", true, now);
    expect(feed.url).toBe("https://example.com/feed.xml");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not silently accept an HTML page with no feed", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("<html><title>普通のページ</title></html>", { status: 200 })));
    await expect(discoverNewsFeed("https://example.com/", false, now)).rejects.toThrow("RSSを見つけられませんでした");
  });

  it("reports when both direct fetch and the opted-in helper fail", async () => {
    const feed = createNewsFeed("https://news.example.test/feed.xml", now);
    const settings = { ...createDefaultSettings(now), newsEnabled: true, newsUseFeedFetchHelper: true, newsFeeds: [feed] };
    await db.settings.put(settings);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("CORS"))
      .mockResolvedValueOnce(new Response("helper failed", { status: 422 }))
      .mockResolvedValueOnce(new Response("reader failed", { status: 503 })));

    const report = await refreshNews(settings, now + 1, true);
    expect(report.successfulFeeds).toBe(0);
    expect(report.errors[0]).toContain("直接取得と許可された取得補助の両方に失敗");
    expect(report.errorDetails[0]?.debugMessage).toContain("HTTP 422");
    expect(report.errorDetails[0]?.debugMessage).toContain("HTTP 503");
  });

  it("falls back to Reader when a feed is blocked and rss2json rejects it", async () => {
    const feed = createNewsFeed("https://news.example.test/feed.xml", now);
    const settings = { ...createDefaultSettings(now), newsEnabled: true, newsUseFeedFetchHelper: true, newsFeeds: [feed] };
    await db.settings.put(settings);
    const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("CORS"))
      .mockResolvedValueOnce(new Response("not convertible", { status: 422 }))
      .mockResolvedValueOnce(new Response(`Title: 主要ニュース\nMarkdown Content:\n### [新しい発表](https://news.example.test/articles/one)\nMon, 13 Jul 2026 01:00:00 GMT`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const report = await refreshNews(settings, now + 1, true);
    expect(report).toMatchObject({ successfulFeeds: 1, addedItems: 1, errors: [] });
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://r.jina.ai/https://news.example.test/feed.xml");
    expect((await db.newsItems.toArray())[0]?.title).toBe("新しい発表");
  });

  it("does not contact a helper when the setting is off", async () => {
    const feed = createNewsFeed("https://news.example.test/feed.xml", now);
    const settings = { ...createDefaultSettings(now), newsEnabled: true, newsFeeds: [feed] };
    await db.settings.put(settings);
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("CORS"));
    vi.stubGlobal("fetch", fetchMock);

    const report = await refreshNews(settings, now + 1, true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report.successfulFeeds).toBe(0);
    expect(report.errors[0]).toContain("直接取得できませんでした");
  });

  it("preserves discussedAt when a feed refresh replaces metadata", async () => {
    const feed = createNewsFeed("https://news.example.test/feed.xml", now);
    const settings = { ...createDefaultSettings(now), newsEnabled: true, newsFeeds: [feed] };
    await db.settings.put(settings);
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>更新通信</title><item><title>同じ記事</title><link>https://news.example.test/one</link></item></channel></rss>`;
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(xml, { status: 200 })));
    await refreshNews(settings, now + 1, true);
    const first = (await db.newsItems.toArray())[0];
    expect(first).toBeDefined();
    await db.newsItems.put({ ...first!, discussedAt: now + 2 });
    await refreshNews(settings, now + 3, true);
    expect((await db.newsItems.toArray())[0]?.discussedAt).toBe(now + 2);
  });

  it("does not restore items after the feed is deleted during an in-flight refresh", async () => {
    const feed = createNewsFeed("https://news.example.test/feed.xml", now);
    const settings = { ...createDefaultSettings(now), newsEnabled: true, newsFeeds: [feed] };
    await db.settings.put(settings);
    let release: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>((resolve) => { release = resolve; })));
    const refreshing = refreshNews(settings, now + 1, true);
    await removeNewsFeed(feed.id, settings, now + 2);
    release?.(new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>遅い通信</title><item><title>遅い記事</title><link>https://news.example.test/late</link></item></channel></rss>`, { status: 200 }));
    await refreshing;
    expect(await db.newsItems.count()).toBe(0);
    expect((await db.settings.get("local"))?.newsFeeds).toHaveLength(0);
  });
});

describe("RSS discovery markup", () => {
  it("deduplicates and resolves public feed links", () => {
    expect(extractFeedLinks(`
      <link rel="alternate" type="application/rss+xml" href="/feed.xml">
      <link rel="alternate" type="application/rss+xml" href="/feed.xml">
      <link rel="alternate" type="application/atom+xml" href="https://example.com/atom.xml">
    `, "https://example.com/blog")).toEqual([
      "https://example.com/feed.xml",
      "https://example.com/atom.xml"
    ]);
  });

  it("returns multiple validated candidates instead of silently choosing the first", async () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="/main.xml"><link rel="alternate" type="application/atom+xml" href="/comments.xml">`;
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(html, { status: 200, headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>全体</title><item><title>記事</title><link>https://example.com/a</link></item></channel></rss>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>コメント</title><entry><title>返信</title><link href="https://example.com/c"/></entry></feed>`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await discoverNewsFeeds("https://example.com/", { useDiscoveryHelper: false, useFeedFetchHelper: false }, now);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((candidate) => candidate.validation === "valid")).toBe(true);
    expect(result.candidates[0]?.title).toBe("全体");
  });
});
