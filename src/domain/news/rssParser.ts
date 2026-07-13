import type { NewsFeedFormat, NewsItem } from "../model/news";

export type ParsedFeed = {
  title: string;
  format: NewsFeedFormat;
  items: NewsItem[];
  fingerprint: string;
};

export function parseRssXml(
  xml: string,
  feedId: string,
  feedUrl: string,
  fetchedAt = Date.now()
): ParsedFeed {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("RSSのXML形式を読み取れませんでした。");
  const rootName = document.documentElement.localName.toLowerCase();
  const format = detectFormat(rootName);
  const atom = format === "atom";
  const channel = atom ? document.documentElement : first(document, "channel");
  const finalBase = resolveXmlBase(document.documentElement, feedUrl);
  const feedTitle = cleanText(textOf(channel, "title"), 80) || hostName(finalBase);
  const entries = elements(document, atom ? "entry" : "item").slice(0, 40);
  const seenUrls = new Set<string>();
  const seenIds = new Set<string>();
  const items = entries.flatMap((entry) => {
    const item = parseEntry(entry, format, feedId, feedTitle, finalBase, fetchedAt);
    if (!item) return [];
    const canonicalUrl = normalizeNewsUrl(item.url);
    if (seenUrls.has(canonicalUrl) || seenIds.has(item.id)) return [];
    seenUrls.add(canonicalUrl);
    seenIds.add(item.id);
    return [item];
  }).slice(0, 20);
  if (items.length === 0) throw new Error("RSSに読める記事がありませんでした。");
  return { title: feedTitle, format, items, fingerprint: feedFingerprint(items) };
}

export function parseRss2Json(
  data: unknown,
  feedId: string,
  feedUrl: string,
  fetchedAt = Date.now()
): ParsedFeed {
  if (!data || typeof data !== "object") throw new Error("取得補助の応答を読み取れませんでした。");
  const payload = data as Record<string, unknown>;
  if (payload.status !== "ok" || !Array.isArray(payload.items)) {
    throw new Error(typeof payload.message === "string" ? cleanText(payload.message, 120) : "RSS取得補助で記事を読めませんでした。");
  }
  const feed = payload.feed && typeof payload.feed === "object" ? (payload.feed as Record<string, unknown>) : {};
  const feedTitle = cleanText(scalarText(feed.title), 80) || hostName(feedUrl);
  const seen = new Set<string>();
  const items = payload.items.slice(0, 40).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const title = cleanText(scalarText(item.title), 140);
    const url = safeArticleUrl(scalarText(item.link), feedUrl);
    const canonicalUrl = normalizeNewsUrl(url);
    if (!title || !url || seen.has(canonicalUrl)) return [];
    seen.add(canonicalUrl);
    const description = cleanText(scalarText(item.description), 240);
    const content = cleanText(scalarText(item.content), 2_000);
    const date = parseFeedDate(scalarText(item.pubDate), fetchedAt);
    const parsed: NewsItem = {
      id: newsId(feedId, canonicalUrl || scalarText(item.guid) || title),
      feedId,
      sourceName: feedTitle,
      title,
      summary: description || cleanText(content, 240),
      ...(content ? { feedContent: content } : {}),
      feedFormat: "rss2",
      url,
      publishedAt: date.timestamp,
      dateStatus: date.status,
      fetchedAt
    };
    return [parsed];
  }).slice(0, 20);
  if (items.length === 0) throw new Error("RSSに読める記事がありませんでした。");
  return { title: feedTitle, format: "rss2", items, fingerprint: feedFingerprint(items) };
}

export function parseReaderMarkdown(
  markdown: string,
  feedId: string,
  feedUrl: string,
  fetchedAt = Date.now()
): ParsedFeed {
  const feedTitle = cleanText(markdown.match(/^Title:\s*(.+)$/imu)?.[1] ?? "", 80) || hostName(feedUrl);
  const headingPattern = /^#{2,4}\s+\[([^\]\r\n]+)\]\((https?:\/\/[^)\s]+)\)\s*$/gimu;
  const headings = Array.from(markdown.matchAll(headingPattern)).slice(0, 40);
  const seen = new Set<string>();
  const items = headings.flatMap((heading, index) => {
    const title = cleanText(heading[1] ?? "", 140);
    const url = safeArticleUrl(heading[2] ?? "", feedUrl);
    const canonicalUrl = normalizeNewsUrl(url);
    if (!title || !url || seen.has(canonicalUrl)) return [];
    seen.add(canonicalUrl);
    const chunkStart = (heading.index ?? 0) + heading[0].length;
    const chunkEnd = headings[index + 1]?.index ?? markdown.length;
    const lines = markdown.slice(chunkStart, chunkEnd).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    const dateLine = lines.find((line) => Number.isFinite(Date.parse(line)));
    const summaryLine = lines.find((line) => isReaderSummaryLine(line, dateLine));
    const date = parseFeedDate(dateLine ?? "", fetchedAt);
    return [{
      id: newsId(feedId, canonicalUrl),
      feedId,
      sourceName: feedTitle,
      title,
      summary: cleanText(stripMarkdownLink(summaryLine ?? ""), 320),
      feedFormat: "rss2" as const,
      url,
      publishedAt: date.timestamp,
      dateStatus: date.status,
      fetchedAt
    }];
  }).slice(0, 20);
  if (items.length === 0) throw new Error("取得補助から読める見出しがありませんでした。");
  return { title: feedTitle, format: "rss2", items, fingerprint: feedFingerprint(items) };
}

function parseEntry(
  entry: Element,
  format: NewsFeedFormat,
  feedId: string,
  feedTitle: string,
  feedUrl: string,
  fetchedAt: number
) {
  const atom = format === "atom";
  const entryBase = resolveXmlBase(entry, feedUrl);
  const title = cleanText(textOf(entry, "title"), 140);
  const linkElement = elements(entry, "link").find((link) => !link.getAttribute("rel") || link.getAttribute("rel") === "alternate");
  const rawLink = atom ? linkElement?.getAttribute("href") ?? textOf(entry, "link") : textOf(entry, "link");
  const url = safeArticleUrl(rawLink, resolveXmlBase(linkElement ?? entry, entryBase));
  if (!title || !url) return null;
  const description = textOf(entry, atom ? "summary" : "description");
  const encoded = textOf(entry, "encoded");
  const atomContent = atom ? textOf(entry, "content") : "";
  const compactSummary = cleanText(description || encoded || atomContent, 240);
  const feedContent = cleanText(encoded || atomContent, 2_000);
  const dateText = atom
    ? textOf(entry, "published") || textOf(entry, "updated")
    : textOf(entry, "pubDate") || textOf(entry, "date");
  const date = parseFeedDate(dateText, fetchedAt);
  const canonicalUrl = normalizeNewsUrl(url);
  return {
    id: newsId(feedId, canonicalUrl || textOf(entry, atom ? "id" : "guid") || title),
    feedId,
    sourceName: feedTitle,
    title,
    summary: compactSummary,
    ...(feedContent ? { feedContent } : {}),
    feedFormat: format,
    url,
    publishedAt: date.timestamp,
    dateStatus: date.status,
    fetchedAt
  } satisfies NewsItem;
}

function detectFormat(rootName: string): NewsFeedFormat {
  if (rootName === "feed") return "atom";
  if (rootName === "rdf") return "rdf";
  if (rootName === "rss") return "rss2";
  throw new Error("RSS 2.0、Atom、RDFのいずれでもありません。");
}

function elements(parent: Document | Element, localName: string) {
  const namespaced = Array.from(parent.getElementsByTagNameNS("*", localName));
  return namespaced.length > 0 ? namespaced : Array.from(parent.getElementsByTagName(localName));
}

function first(parent: Document | Element, localName: string) {
  return elements(parent, localName)[0] ?? null;
}

function textOf(parent: Document | Element | null, localName: string) {
  return parent ? first(parent, localName)?.textContent?.trim() ?? "" : "";
}

export function cleanFeedText(value: string, maxLength: number) {
  return cleanText(value, maxLength);
}

function cleanText(value: string, maxLength: number) {
  const document = new DOMParser().parseFromString(`<body>${value}</body>`, "text/html");
  const normalized = (document.body.textContent ?? "").replace(/\s+/gu, " ").trim();
  if (Array.from(normalized).length <= maxLength) return normalized;
  return `${Array.from(normalized).slice(0, Math.max(0, maxLength - 1)).join("")}…`;
}

function safeArticleUrl(value: string, base: string) {
  try {
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

export function normalizeNewsUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid|yclid|mc_cid|mc_eid)$/iu.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/u, "");
    return url.href;
  } catch {
    return "";
  }
}

function resolveXmlBase(element: Element, fallback: string) {
  const chain: Element[] = [];
  let current: Element | null = element;
  while (current) {
    chain.unshift(current);
    current = current.parentElement;
  }
  return chain.reduce((base, part) => {
    const value = part.getAttributeNS("http://www.w3.org/XML/1998/namespace", "base") ?? part.getAttribute("xml:base");
    if (!value) return base;
    try {
      return new URL(value, base).href;
    } catch {
      return base;
    }
  }, fallback);
}

function hostName(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "登録したRSS";
  }
}

function parseFeedDate(value: string, fetchedAt: number): { timestamp: number; status: NonNullable<NewsItem["dateStatus"]> } {
  if (!value.trim()) return { timestamp: fetchedAt, status: "missing" };
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return { timestamp: fetchedAt, status: "invalid" };
  if (timestamp > fetchedAt + 86_400_000) return { timestamp: fetchedAt, status: "future" };
  return { timestamp, status: "feed" };
}

function newsId(feedId: string, sourceId: string) {
  return `news_${hashText(`${feedId}:${sourceId}`)}`;
}

function feedFingerprint(items: NewsItem[]) {
  return hashText(items.slice(0, 5).map((item) => `${normalizeNewsUrl(item.url)}\u0000${item.title}`).join("\u0001"));
}

function hashText(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function scalarText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function isReaderSummaryLine(line: string, dateLine: string | undefined) {
  if (line === dateLine) return false;
  if (/^(?:Title|URL Source|Markdown Content):/iu.test(line)) return false;
  if (/^https?:\/\//iu.test(line)) return false;
  if (/^\[[^\]]+\]\(https?:\/\/[^)]+\)$/iu.test(line)) return false;
  return true;
}

function stripMarkdownLink(value: string) {
  return value.replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1");
}
