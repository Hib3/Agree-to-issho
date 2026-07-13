import type { NewsFeedConfig, NewsRefreshReport } from "../../domain/model/news";
import type { GameSettings } from "../../domain/model/player";
import { parseRss2Json, parseRssXml } from "../../domain/news/rssParser";
import { db } from "../db/database";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_FEED_BYTES = 1_000_000;

export function createNewsFeed(urlText: string, now = Date.now()): NewsFeedConfig {
  const url = publicFeedUrl(urlText);
  return {
    id: `feed_${hashText(url.href)}`,
    name: url.hostname,
    url: url.href,
    enabled: true,
    addedAt: now
  };
}

export function shouldRefreshNews(settings: GameSettings, now = Date.now()) {
  if (!settings.newsEnabled || (typeof navigator !== "undefined" && !navigator.onLine)) return false;
  const interval = settings.newsRefreshMinutes * 60_000;
  return settings.newsFeeds.some((feed) => feed.enabled && now - (feed.lastCheckedAt ?? 0) >= interval);
}

export async function refreshNews(settings: GameSettings, now = Date.now(), force = false): Promise<NewsRefreshReport> {
  const report: NewsRefreshReport = { checkedFeeds: 0, successfulFeeds: 0, addedItems: 0, errors: [] };
  const interval = settings.newsRefreshMinutes * 60_000;
  const feeds = settings.newsFeeds.filter(
    (feed) => feed.enabled && (force || now - (feed.lastCheckedAt ?? 0) >= interval)
  );
  const nextFeeds = [...settings.newsFeeds];
  for (const feed of feeds) {
    report.checkedFeeds += 1;
    const index = nextFeeds.findIndex((item) => item.id === feed.id);
    try {
      const parsed = await fetchFeed(feed, settings.newsUseRss2Json, now);
      const existing = await db.newsItems.bulkGet(parsed.items.map((item) => item.id));
      const existingIds = new Set(existing.flatMap((item) => item ? [item.id] : []));
      await db.newsItems.bulkPut(parsed.items);
      report.addedItems += parsed.items.filter((item) => !existingIds.has(item.id)).length;
      report.successfulFeeds += 1;
      const healthyFeed = { ...feed };
      delete healthyFeed.lastError;
      nextFeeds[index] = { ...healthyFeed, name: parsed.title, lastCheckedAt: now, lastSuccessAt: now };
    } catch (error) {
      const message = readableError(error);
      report.errors.push(`${feed.name}: ${message}`);
      nextFeeds[index] = { ...feed, lastCheckedAt: now, lastError: message };
    }
  }
  if (feeds.length > 0) {
    const latest = await db.settings.get("local");
    if (latest) {
      const updates = new Map(nextFeeds.map((feed) => [feed.id, feed]));
      const mergedFeeds = latest.newsFeeds.map((feed) => {
        const update = updates.get(feed.id);
        if (!update) return feed;
        const merged: NewsFeedConfig = {
          ...feed,
          name: update.name,
          lastCheckedAt: update.lastCheckedAt,
          lastSuccessAt: update.lastSuccessAt
        };
        if (update.lastError) merged.lastError = update.lastError;
        else delete merged.lastError;
        return merged;
      });
      await db.settings.put({ ...latest, newsFeeds: mergedFeeds, updatedAt: now });
    }
    const staleIds = await db.newsItems.orderBy("publishedAt").reverse().offset(120).primaryKeys();
    if (staleIds.length > 0) await db.newsItems.bulkDelete(staleIds);
  }
  return report;
}

export async function removeNewsFeed(feedId: string, settings: GameSettings, now = Date.now()) {
  await db.transaction("rw", db.settings, db.newsItems, async () => {
    await db.newsItems.where("feedId").equals(feedId).delete();
    await db.settings.put({
      ...settings,
      newsFeeds: settings.newsFeeds.filter((feed) => feed.id !== feedId),
      updatedAt: now
    });
  });
}

async function fetchFeed(feed: NewsFeedConfig, useRss2Json: boolean, now: number) {
  try {
    const response = await fetchWithTimeout(feed.url);
    const text = await limitedText(response);
    return parseRssXml(text, feed.id, feed.url, now);
  } catch (directError) {
    if (!useRss2Json) throw directError;
    const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
    const response = await fetchWithTimeout(endpoint);
    return parseRss2Json(JSON.parse(await limitedText(response)), feed.id, feed.url, now);
  }
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json" }
    });
    if (!response.ok) throw new Error(`取得先がHTTP ${response.status}を返しました。`);
    return response;
  } finally {
    window.clearTimeout(timer);
  }
}

async function limitedText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_FEED_BYTES) throw new Error("RSSが大きすぎるため読み込みませんでした。");
  const text = await response.text();
  if (new Blob([text]).size > MAX_FEED_BYTES) throw new Error("RSSが大きすぎるため読み込みませんでした。");
  return text;
}

function publicFeedUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("https:// で始まるRSS URLを入力してください。");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("公開されたHTTPSのRSS URLだけ登録できます。");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "[::1]" ||
    /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/u.test(host)
  ) {
    throw new Error("端末内や家庭内ネットワークのURLは登録できません。");
  }
  return url;
}

function readableError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return "時間内に応答がありませんでした。";
  if (error instanceof TypeError) return "直接取得できませんでした。取得補助を有効にすると読める場合があります。";
  return error instanceof Error ? error.message : "RSSを取得できませんでした。";
}

function hashText(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
