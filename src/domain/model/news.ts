export type NewsFeedConfig = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  addedAt: number;
  lastCheckedAt?: number | undefined;
  lastSuccessAt?: number | undefined;
  lastError?: string | undefined;
};

export type NewsFeedFormat = "rss2" | "atom" | "rdf";

export type NewsFeedCandidate = {
  url: string;
  canonicalUrl: string;
  title: string;
  format?: NewsFeedFormat | undefined;
  discoveredBy: "direct" | "html_alternate" | "feedsearch";
  sameHost: boolean;
  score: number;
  validation: "valid" | "unverified" | "invalid";
  validationDetail?: string | undefined;
  latestArticle?: string | undefined;
};

export type FeedDiscoveryResult = {
  inputUrl: string;
  inputKind: "site" | "feed" | "unknown";
  directFetch:
    | { status: "success"; finalUrl: string; contentType: string }
    | { status: "cors_error" | "http_error" | "timeout" | "parse_error"; detail: string };
  candidates: NewsFeedCandidate[];
  usedExternalHelper: boolean;
  helperName?: "feedsearch" | undefined;
};

export type NewsItem = {
  id: string;
  feedId: string;
  sourceName: string;
  title: string;
  summary: string;
  feedContent?: string | undefined;
  feedFormat?: NewsFeedFormat | undefined;
  url: string;
  publishedAt: number;
  dateStatus?: "feed" | "missing" | "invalid" | "future" | undefined;
  fetchedAt: number;
  discussedAt?: number | undefined;
};

export type NewsRefreshReport = {
  checkedFeeds: number;
  successfulFeeds: number;
  addedItems: number;
  errors: string[];
  errorDetails: NewsErrorDetail[];
};

export type NewsErrorDetail = {
  code: "invalid_url" | "cors" | "timeout" | "http" | "parse" | "size" | "aborted" | "helper" | "unknown";
  stage: "discovery" | "feed_fetch" | "feed_parse" | "article_fetch" | "article_parse";
  provider: "direct" | "feedsearch" | "rss2json" | "jina";
  status?: number | undefined;
  retryable: boolean;
  userMessage: string;
  debugMessage: string;
};
