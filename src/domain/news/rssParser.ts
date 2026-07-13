import type { NewsItem } from "../model/news";

export type ParsedFeed = { title: string; items: NewsItem[] };

export function parseRssXml(xml: string, feedId: string, feedUrl: string, fetchedAt = Date.now()): ParsedFeed {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("RSSの形式を読み取れませんでした。");
  const rootName = document.documentElement.localName.toLowerCase();
  const atom = rootName === "feed";
  const feedTitle = cleanText(textOf(atom ? document.documentElement : first(document, "channel"), "title"), 80) || hostName(feedUrl);
  const entries = elements(document, atom ? "entry" : "item").slice(0, 20);
  const items = entries
    .map((entry) => parseEntry(entry, atom, feedId, feedTitle, feedUrl, fetchedAt))
    .filter((item): item is NewsItem => Boolean(item));
  if (items.length === 0) throw new Error("RSSに読める記事がありませんでした。");
  return { title: feedTitle, items };
}

export function parseRss2Json(data: unknown, feedId: string, feedUrl: string, fetchedAt = Date.now()): ParsedFeed {
  if (!data || typeof data !== "object") throw new Error("取得補助の応答を読み取れませんでした。");
  const payload = data as Record<string, unknown>;
  if (payload.status !== "ok" || !Array.isArray(payload.items)) {
    throw new Error(typeof payload.message === "string" ? cleanText(payload.message, 120) : "RSS取得補助で記事を読めませんでした。");
  }
  const feed = payload.feed && typeof payload.feed === "object" ? (payload.feed as Record<string, unknown>) : {};
  const feedTitle = cleanText(scalarText(feed.title), 80) || hostName(feedUrl);
  const items = payload.items.slice(0, 20).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const title = cleanText(scalarText(item.title), 140);
    const url = safeArticleUrl(scalarText(item.link), feedUrl);
    if (!title || !url) return [];
    const summary = cleanText(scalarText(item.description) || scalarText(item.content), 240);
    const publishedAt = parseDate(scalarText(item.pubDate), fetchedAt);
    const sourceId = scalarText(item.guid) || url || title;
    return [{
      id: newsId(feedId, sourceId),
      feedId,
      sourceName: feedTitle,
      title,
      summary,
      url,
      publishedAt,
      fetchedAt
    } satisfies NewsItem];
  });
  if (items.length === 0) throw new Error("RSSに読める記事がありませんでした。");
  return { title: feedTitle, items };
}

function parseEntry(entry: Element, atom: boolean, feedId: string, feedTitle: string, feedUrl: string, fetchedAt: number) {
  const title = cleanText(textOf(entry, "title"), 140);
  const linkElement = elements(entry, "link").find((link) => !link.getAttribute("rel") || link.getAttribute("rel") === "alternate");
  const rawLink = atom ? linkElement?.getAttribute("href") ?? textOf(entry, "link") : textOf(entry, "link");
  const url = safeArticleUrl(rawLink, feedUrl);
  if (!title || !url) return null;
  const summary = cleanText(textOf(entry, atom ? "summary" : "description") || textOf(entry, "content"), 240);
  const publishedAt = parseDate(textOf(entry, atom ? "updated" : "pubDate") || textOf(entry, "published"), fetchedAt);
  const sourceId = textOf(entry, atom ? "id" : "guid") || url || title;
  return {
    id: newsId(feedId, sourceId),
    feedId,
    sourceName: feedTitle,
    title,
    summary,
    url,
    publishedAt,
    fetchedAt
  } satisfies NewsItem;
}

function elements(parent: Document | Element, localName: string) {
  const namespaced = Array.from(parent.getElementsByTagNameNS("*", localName));
  return namespaced.length > 0 ? namespaced : Array.from(parent.getElementsByTagName(localName));
}

function first(parent: Document | Element, localName: string) {
  return elements(parent, localName)[0] ?? null;
}

function textOf(parent: Document | Element | null, localName: string) {
  return first(parent ?? new DOMParser().parseFromString("<empty/>", "application/xml"), localName)?.textContent?.trim() ?? "";
}

function cleanText(value: string, maxLength: number) {
  const document = new DOMParser().parseFromString(`<body>${value}</body>`, "text/html");
  const normalized = (document.body.textContent ?? "").replace(/\s+/gu, " ").trim();
  if (Array.from(normalized).length <= maxLength) return normalized;
  return `${Array.from(normalized).slice(0, maxLength - 1).join("")}…`;
}

function safeArticleUrl(value: string, base: string) {
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function hostName(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "登録したRSS";
  }
}

function parseDate(value: string, fallback: number) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function newsId(feedId: string, sourceId: string) {
  let hash = 2166136261;
  for (const character of `${feedId}:${sourceId}`) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `news_${(hash >>> 0).toString(16)}`;
}

function scalarText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
