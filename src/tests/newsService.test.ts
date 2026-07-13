import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../domain/settings/gameSettings";
import { db } from "../infrastructure/db/database";
import { createNewsFeed, refreshNews } from "../infrastructure/news/newsService";

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
      newsUseRss2Json: true,
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
});
