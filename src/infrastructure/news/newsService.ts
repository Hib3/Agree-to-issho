import type {
  FeedDiscoveryResult,
  NewsErrorDetail,
  NewsFeedCandidate,
  NewsFeedConfig,
  NewsRefreshReport
} from "../../domain/model/news";
import type { GameSettings } from "../../domain/model/player";
import { normalizeNewsUrl, parseReaderMarkdown, parseRss2Json, parseRssXml, type ParsedFeed } from "../../domain/news/rssParser";
import { db } from "../db/database";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_FEED_BYTES = 1_000_000;
const MAX_DISCOVERY_CANDIDATES = 5;
const FEEDSEARCH_ENDPOINT = "https://feedsearch.dev/api/v1/search";
const READER_ENDPOINT = "https://r.jina.ai/";
const FEED_ACCEPT = "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json";
const DISCOVERY_ACCEPT = `${FEED_ACCEPT}, text/html`;

type DiscoveryConsent = {
  useDiscoveryHelper: boolean;
  useFeedFetchHelper: boolean;
  signal?: AbortSignal | undefined;
};

type FetchResult = {
  text: string;
  finalUrl: string;
  contentType: string;
};

export class NewsServiceError extends Error {
  constructor(public readonly detail: NewsErrorDetail) {
    super(detail.userMessage);
    this.name = "NewsServiceError";
  }
}

export function createNewsFeed(urlText: string, now = Date.now(), name?: string): NewsFeedConfig {
  const url = publicFeedUrl(urlText);
  const canonicalUrl = normalizeNewsUrl(url.href);
  return {
    id: `feed_${hashText(canonicalUrl)}`,
    name: name?.trim().slice(0, 80) || url.hostname,
    url: canonicalUrl,
    enabled: true,
    addedAt: now
  };
}

export function createNewsFeedFromCandidate(candidate: NewsFeedCandidate, now = Date.now()) {
  if (candidate.validation === "invalid") throw serviceError("parse", "discovery", "direct", "この候補はRSSとして確認できませんでした。", candidate.validationDetail ?? "invalid candidate", false);
  return createNewsFeed(candidate.canonicalUrl, now, candidate.title);
}

export async function discoverNewsFeeds(
  urlText: string,
  consent: DiscoveryConsent,
  now = Date.now()
): Promise<FeedDiscoveryResult> {
  const input = publicFeedUrl(urlText);
  const inputKind = looksLikeFeedUrl(input) ? "feed" : "unknown";
  let directFetch: FeedDiscoveryResult["directFetch"];
  let directCandidates: NewsFeedCandidate[] = [];
  let directError: NewsServiceError | undefined;

  try {
    const response = await fetchBoundedText(input.href, DISCOVERY_ACCEPT, consent.signal);
    directFetch = { status: "success", finalUrl: response.finalUrl, contentType: response.contentType };
    try {
      const parsed = parseRssXml(response.text, `discovery_${hashText(response.finalUrl)}`, response.finalUrl, now);
      directCandidates = [candidateFromParsed(response.finalUrl, input.href, parsed, "direct", 100)];
    } catch (error) {
      const links = extractFeedLinks(response.text, response.finalUrl).slice(0, MAX_DISCOVERY_CANDIDATES);
      directCandidates = await validateCandidates(
        links.map((url, index) => ({ url, title: "", discoveredBy: "html_alternate" as const, score: 90 - index })),
        input.href,
        consent,
        now
      );
      if (directCandidates.length === 0) directError = asNewsError(error, "feed_parse", "direct");
    }
  } catch (error) {
    directError = asNewsError(error, "discovery", "direct");
    directFetch = {
      status: discoveryStatus(directError.detail),
      detail: directError.detail.userMessage
    };
    if (looksLikeFeedUrl(input)) {
      directCandidates = [unverifiedCandidate(input.href, input.href, "direct", 70, directError.detail.userMessage)];
    }
  }

  let helperCandidates: NewsFeedCandidate[] = [];
  let usedExternalHelper = false;
  if (consent.useDiscoveryHelper && inputKind !== "feed" && directCandidates.every((candidate) => candidate.validation !== "valid")) {
    usedExternalHelper = true;
    const raw = await discoverWithFeedsearch(input.href, consent.signal);
    helperCandidates = await validateCandidates(raw.slice(0, MAX_DISCOVERY_CANDIDATES), input.href, consent, now);
  }

  const candidates = dedupeCandidates([...directCandidates, ...helperCandidates])
    .sort(compareCandidates)
    .slice(0, MAX_DISCOVERY_CANDIDATES);
  if (candidates.length === 0) {
    if (!consent.useDiscoveryHelper && directError?.detail.code === "cors" && !looksLikeFeedUrl(input)) {
      throw serviceError("cors", "discovery", "direct", "サイトを直接確認できませんでした。RSS探索補助を許可すると探せる場合があります。", directError.detail.debugMessage, true);
    }
    throw serviceError("parse", "discovery", "direct", "このURLからRSSを見つけられませんでした。", directError?.detail.debugMessage ?? "no candidates", false);
  }
  return {
    inputUrl: input.href,
    inputKind: inputKind === "unknown" && directCandidates.some((candidate) => candidate.discoveredBy === "html_alternate") ? "site" : inputKind,
    directFetch,
    candidates,
    usedExternalHelper,
    ...(usedExternalHelper ? { helperName: "feedsearch" as const } : {})
  };
}

// Backward-compatible helper for callers that can only accept one feed.
export async function discoverNewsFeed(urlText: string, useHelper: boolean, now = Date.now()): Promise<NewsFeedConfig> {
  const result = await discoverNewsFeeds(urlText, {
    useDiscoveryHelper: useHelper,
    useFeedFetchHelper: useHelper
  }, now);
  const candidate = result.candidates.find((item) => item.validation === "valid") ?? result.candidates[0];
  if (!candidate) throw new Error("このURLからRSSを見つけられませんでした。");
  return createNewsFeedFromCandidate(candidate, now);
}

export function shouldRefreshNews(settings: GameSettings, now = Date.now()) {
  if (!settings.newsEnabled || (typeof navigator !== "undefined" && !navigator.onLine)) return false;
  const interval = settings.newsRefreshMinutes * 60_000;
  return settings.newsFeeds.some((feed) => feed.enabled && now - (feed.lastCheckedAt ?? 0) >= interval);
}

export async function refreshNews(
  settings: GameSettings,
  now = Date.now(),
  force = false,
  signal?: AbortSignal
): Promise<NewsRefreshReport> {
  const report: NewsRefreshReport = { checkedFeeds: 0, successfulFeeds: 0, addedItems: 0, errors: [], errorDetails: [] };
  const interval = settings.newsRefreshMinutes * 60_000;
  const feeds = settings.newsFeeds.filter((feed) => feed.enabled && (force || now - (feed.lastCheckedAt ?? 0) >= interval));
  for (const feed of feeds) {
    if (signal?.aborted) break;
    report.checkedFeeds += 1;
    try {
      const parsed = await fetchFeed(feed, settings.newsUseFeedFetchHelper, now, signal);
      const result = await saveRefreshSuccess(feed, parsed, now);
      if (!result.saved) continue;
      report.addedItems += result.addedItems;
      report.successfulFeeds += 1;
    } catch (error) {
      const detail = asNewsError(error, "feed_fetch", "direct").detail;
      if (detail.code === "aborted") break;
      report.errors.push(`${feed.name}: ${detail.userMessage}`);
      report.errorDetails.push(detail);
      await saveRefreshError(feed, detail.userMessage, now);
    }
  }
  if (report.successfulFeeds > 0) {
    const staleIds = await db.newsItems.orderBy("publishedAt").reverse().offset(120).primaryKeys();
    if (staleIds.length > 0) await db.newsItems.bulkDelete(staleIds);
  }
  return report;
}

export async function removeNewsFeed(feedId: string, _settings?: GameSettings, now = Date.now()) {
  await db.transaction("rw", db.settings, db.newsItems, async () => {
    const latest = await db.settings.get("local");
    if (!latest) return;
    await db.newsItems.where("feedId").equals(feedId).delete();
    await db.settings.put({
      ...latest,
      newsFeeds: latest.newsFeeds.filter((feed) => feed.id !== feedId),
      updatedAt: now
    });
  });
}

async function saveRefreshSuccess(feed: NewsFeedConfig, parsed: ParsedFeed, now: number) {
  return db.transaction("rw", db.settings, db.newsItems, async () => {
    const latest = await db.settings.get("local");
    const current = latest?.newsFeeds.find((item) => item.id === feed.id);
    if (!latest || !current || !current.enabled || normalizeNewsUrl(current.url) !== normalizeNewsUrl(feed.url)) {
      return { saved: false, addedItems: 0 };
    }
    const existing = await db.newsItems.bulkGet(parsed.items.map((item) => item.id));
    const merged = parsed.items.map((item, index) => ({
      ...item,
      ...(existing[index]?.discussedAt ? { discussedAt: existing[index]?.discussedAt } : {})
    }));
    const addedItems = existing.filter((item) => !item).length;
    await db.newsItems.bulkPut(merged);
    await db.settings.put({
      ...latest,
      newsFeeds: latest.newsFeeds.map((item) => item.id === feed.id
        ? withoutLastError({ ...item, name: parsed.title, lastCheckedAt: now, lastSuccessAt: now })
        : item),
      updatedAt: now
    });
    return { saved: true, addedItems };
  });
}

async function saveRefreshError(feed: NewsFeedConfig, message: string, now: number) {
  await db.transaction("rw", db.settings, async () => {
    const latest = await db.settings.get("local");
    if (!latest || !latest.newsFeeds.some((item) => item.id === feed.id)) return;
    await db.settings.put({
      ...latest,
      newsFeeds: latest.newsFeeds.map((item) => item.id === feed.id ? { ...item, lastCheckedAt: now, lastError: message } : item),
      updatedAt: now
    });
  });
}

async function fetchFeed(feed: NewsFeedConfig, useHelper: boolean, now: number, signal?: AbortSignal) {
  try {
    const response = await fetchBoundedText(feed.url, FEED_ACCEPT, signal);
    return parseRssXml(response.text, feed.id, response.finalUrl, now);
  } catch (directError) {
    if (!useHelper || signal?.aborted) throw directError;
    let rss2JsonError: NewsServiceError | undefined;
    try {
      const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
      const response = await fetchBoundedText(endpoint, "application/json", signal);
      return parseRss2Json(JSON.parse(response.text), feed.id, feed.url, now);
    } catch (error) {
      rss2JsonError = asNewsError(error, "feed_fetch", "rss2json");
    }
    try {
      const response = await fetchBoundedText(`${READER_ENDPOINT}${feed.url}`, "text/plain", signal);
      return parseReaderMarkdown(response.text, feed.id, feed.url, now);
    } catch (error) {
      const readerError = asNewsError(error, "feed_fetch", "jina");
      throw serviceError(
        "helper",
        "feed_fetch",
        "jina",
        "直接取得と許可された取得補助の両方に失敗しました。",
        `direct=${debugError(directError)}; rss2json=${rss2JsonError.detail.debugMessage}; jina=${readerError.detail.debugMessage}`,
        readerError.detail.retryable || rss2JsonError.detail.retryable
      );
    }
  }
}

async function validateCandidates(
  records: Array<{ url: string; title: string; discoveredBy: NewsFeedCandidate["discoveredBy"]; score: number }>,
  inputUrl: string,
  consent: DiscoveryConsent,
  now: number
) {
  const results: NewsFeedCandidate[] = [];
  for (const record of records.slice(0, MAX_DISCOVERY_CANDIDATES)) {
    let url: URL;
    try {
      url = publicFeedUrl(record.url);
    } catch {
      continue;
    }
    const canonicalUrl = normalizeNewsUrl(url.href);
    try {
      const temporary = createNewsFeed(canonicalUrl, now, record.title);
      const parsed = await fetchFeed(temporary, consent.useFeedFetchHelper, now, consent.signal);
      results.push({
        url: canonicalUrl,
        canonicalUrl,
        title: parsed.title,
        format: parsed.format,
        discoveredBy: record.discoveredBy,
        sameHost: sameHost(canonicalUrl, inputUrl),
        score: candidateScore(record.score, canonicalUrl, parsed.title, inputUrl),
        validation: "valid",
        latestArticle: parsed.items[0]?.title
      });
    } catch (error) {
      const detail = asNewsError(error, "feed_fetch", "direct").detail;
      results.push({
        url: canonicalUrl,
        canonicalUrl,
        title: record.title || url.hostname,
        discoveredBy: record.discoveredBy,
        sameHost: sameHost(canonicalUrl, inputUrl),
        score: candidateScore(record.score, canonicalUrl, record.title, inputUrl),
        validation: detail.code === "cors" || detail.code === "timeout" ? "unverified" : "invalid",
        validationDetail: detail.userMessage
      });
    }
  }
  return results;
}

async function discoverWithFeedsearch(siteUrl: string, signal?: AbortSignal) {
  const endpoint = `${FEEDSEARCH_ENDPOINT}?url=${encodeURIComponent(siteUrl)}&info=true&favicon=false&opml=false`;
  try {
    const response = await fetchBoundedText(endpoint, "application/json", signal);
    const data: unknown = JSON.parse(response.text);
    const candidates = feedsearchCandidates(data)
      .filter((candidate) => {
        try {
          publicFeedUrl(candidate.url);
          return true;
        } catch {
          return false;
        }
      });
    if (candidates.length === 0) throw new Error("no candidates");
    return candidates;
  } catch (error) {
    throw asNewsError(error, "discovery", "feedsearch");
  }
}

export function extractFeedLinks(html: string, baseUrl: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const selectors = [
    'link[rel~="alternate"][type="application/rss+xml"]',
    'link[rel~="alternate"][type="application/atom+xml"]',
    'a[type="application/rss+xml"]',
    'a[type="application/atom+xml"]'
  ];
  const links = selectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLLinkElement | HTMLAnchorElement>(selector)));
  return [...new Set(links.flatMap((link) => {
    const href = link.getAttribute("href");
    if (!href) return [];
    try {
      return [normalizeNewsUrl(publicFeedUrl(new URL(href, baseUrl).href).href)];
    } catch {
      return [];
    }
  }))];
}

async function fetchBoundedText(url: string, accept: string, parentSignal?: AbortSignal): Promise<FetchResult> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort("timeout"), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { Accept: accept }
    });
    if (!response.ok) {
      throw serviceError("http", "feed_fetch", "direct", httpUserMessage(response.status), `HTTP ${response.status} ${response.statusText}`.trim(), retryableStatus(response.status), response.status);
    }
    const text = await readLimitedBody(response, controller);
    return {
      text,
      finalUrl: response.url || url,
      contentType: response.headers.get("content-type") ?? ""
    };
  } catch (error) {
    if (error instanceof NewsServiceError) throw error;
    if (controller.signal.aborted) {
      if (parentSignal?.aborted) throw serviceError("aborted", "feed_fetch", "direct", "更新を中止しました。", "parent signal aborted", false);
      throw serviceError("timeout", "feed_fetch", "direct", "時間内に応答がありませんでした。", "request or body timeout", true);
    }
    if (error instanceof TypeError) throw serviceError("cors", "feed_fetch", "direct", "ブラウザから直接取得できませんでした。", error.message, true);
    throw asNewsError(error, "feed_fetch", "direct");
  } finally {
    globalThis.clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

async function readLimitedBody(response: Response, controller: AbortController) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_FEED_BYTES) throw serviceError("size", "feed_fetch", "direct", "RSSが大きすぎるため読み込みませんでした。", `content-length=${declaredLength}`, false);
  if (!response.body) {
    const text = await response.text();
    if (new Blob([text]).size > MAX_FEED_BYTES) throw serviceError("size", "feed_fetch", "direct", "RSSが大きすぎるため読み込みませんでした。", "body exceeded limit", false);
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_FEED_BYTES) {
      controller.abort("size");
      throw serviceError("size", "feed_fetch", "direct", "RSSが大きすぎるため読み込みませんでした。", `stream bytes>${MAX_FEED_BYTES}`, false);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function candidateFromParsed(url: string, inputUrl: string, parsed: ParsedFeed, discoveredBy: NewsFeedCandidate["discoveredBy"], score: number): NewsFeedCandidate {
  const canonicalUrl = normalizeNewsUrl(url);
  return {
    url: canonicalUrl,
    canonicalUrl,
    title: parsed.title,
    format: parsed.format,
    discoveredBy,
    sameHost: sameHost(canonicalUrl, inputUrl),
    score: candidateScore(score, canonicalUrl, parsed.title, inputUrl),
    validation: "valid",
    latestArticle: parsed.items[0]?.title
  };
}

function unverifiedCandidate(url: string, inputUrl: string, discoveredBy: NewsFeedCandidate["discoveredBy"], score: number, detail: string): NewsFeedCandidate {
  const canonicalUrl = normalizeNewsUrl(url);
  return {
    url: canonicalUrl,
    canonicalUrl,
    title: new URL(canonicalUrl).hostname,
    discoveredBy,
    sameHost: sameHost(canonicalUrl, inputUrl),
    score,
    validation: "unverified",
    validationDetail: detail
  };
}

function dedupeCandidates(candidates: NewsFeedCandidate[]) {
  const byUrl = new Map<string, NewsFeedCandidate>();
  for (const candidate of candidates) {
    const current = byUrl.get(candidate.canonicalUrl);
    if (!current || compareCandidates(candidate, current) < 0) byUrl.set(candidate.canonicalUrl, candidate);
  }
  return [...byUrl.values()];
}

function compareCandidates(left: NewsFeedCandidate, right: NewsFeedCandidate) {
  const validationRank = { valid: 2, unverified: 1, invalid: 0 };
  return validationRank[right.validation] - validationRank[left.validation]
    || Number(right.sameHost) - Number(left.sameHost)
    || right.score - left.score;
}

function candidateScore(base: number, url: string, title: string, inputUrl: string) {
  let score = base + (sameHost(url, inputUrl) ? 15 : 0);
  if (/(?:comment|comments|reply|responses)/iu.test(`${url} ${title}`)) score -= 40;
  if (/(?:category|tag|author)/iu.test(url)) score -= 15;
  if (/(?:all|main|top|index|feed|rss)/iu.test(`${url} ${title}`)) score += 5;
  return score;
}

function feedsearchCandidates(data: unknown) {
  const records = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { result?: unknown }).result)
      ? (data as { result: unknown[] }).result
      : [];
  return records.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const candidate = record as { url?: unknown; title?: unknown; score?: unknown };
    if (typeof candidate.url !== "string") return [];
    return [{
      url: candidate.url,
      title: typeof candidate.title === "string" ? candidate.title.slice(0, 80) : "",
      discoveredBy: "feedsearch" as const,
      score: typeof candidate.score === "number" ? candidate.score : 0
    }];
  });
}

function looksLikeFeedUrl(url: URL) {
  return /(?:\.(?:xml|rss|atom)(?:$|[?#])|\/(?:rss(?:_?2(?:\.0)?)?|atom|feed)(?:\/|$)|[?&]feed=(?:rss|rss2|atom))/iu.test(url.href);
}

function sameHost(left: string, right: string) {
  try {
    return new URL(left).hostname.replace(/^www\./u, "") === new URL(right).hostname.replace(/^www\./u, "");
  } catch {
    return false;
  }
}

function publicFeedUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw serviceError("invalid_url", "discovery", "direct", "https:// で始まるRSS URLを入力してください。", `invalid URL: ${value}`, false);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw serviceError("invalid_url", "discovery", "direct", "公開されたHTTPSのRSS URLだけ登録できます。", `rejected protocol or credentials: ${url.href}`, false);
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "[::1]" ||
    /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/u.test(host)
  ) {
    throw serviceError("invalid_url", "discovery", "direct", "端末内や家庭内ネットワークのURLは登録できません。", `private host: ${host}`, false);
  }
  url.hash = "";
  return url;
}

function serviceError(
  code: NewsErrorDetail["code"],
  stage: NewsErrorDetail["stage"],
  provider: NewsErrorDetail["provider"],
  userMessage: string,
  debugMessage: string,
  retryable: boolean,
  status?: number
) {
  return new NewsServiceError({ code, stage, provider, ...(status ? { status } : {}), retryable, userMessage, debugMessage });
}

function asNewsError(error: unknown, stage: NewsErrorDetail["stage"], provider: NewsErrorDetail["provider"]) {
  if (error instanceof NewsServiceError) {
    if (error.detail.stage === stage && error.detail.provider === provider) return error;
    return new NewsServiceError({ ...error.detail, stage, provider });
  }
  if (error instanceof DOMException && error.name === "AbortError") return serviceError("aborted", stage, provider, "更新を中止しました。", error.message, false);
  if (error instanceof TypeError) return serviceError("cors", stage, provider, "ブラウザから直接取得できませんでした。", error.message, true);
  if (error instanceof SyntaxError) return serviceError("parse", stage, provider, "取得したデータの形式を読み取れませんでした。", error.message, false);
  return serviceError("parse", stage, provider, error instanceof Error ? error.message : "RSSを読み取れませんでした。", debugError(error), false);
}

function discoveryStatus(detail: NewsErrorDetail): "cors_error" | "http_error" | "timeout" | "parse_error" {
  if (detail.code === "cors") return "cors_error";
  if (detail.code === "http") return "http_error";
  if (detail.code === "timeout") return "timeout";
  return "parse_error";
}

function httpUserMessage(status: number) {
  if (status === 401 || status === 403) return "取得先からアクセスを許可されませんでした。";
  if (status === 404) return "RSSが見つかりませんでした。";
  if (status === 408) return "取得先で時間切れになりました。";
  if (status === 429) return "取得回数が多いため、しばらく待つ必要があります。";
  if (status >= 500) return "取得先で一時的な問題が起きています。";
  return `取得先がHTTP ${status}を返しました。`;
}

function retryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function withoutLastError(feed: NewsFeedConfig) {
  const healthy = { ...feed };
  delete healthy.lastError;
  return healthy;
}

function debugError(error: unknown) {
  return error instanceof NewsServiceError ? error.detail.debugMessage : error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function hashText(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
