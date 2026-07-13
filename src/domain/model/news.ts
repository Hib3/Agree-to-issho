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

export type ArticleContentLevel = "headline_only" | "feed_summary" | "feed_content" | "article_extract";
export type ArticleTone = "positive" | "negative" | "neutral" | "mixed" | "sensitive" | "unknown";

export type ArticleEvidence = {
  id: string;
  text: string;
  source: "headline" | "feed_summary" | "feed_content" | "article";
};

export type GroundedArticleFact = {
  id: string;
  text: string;
  evidenceId: string;
};

export type ArticleDigest = {
  newsItemId: string;
  contentLevel: ArticleContentLevel;
  sourceUrl: string;
  extractedAt: number;
  keyFacts: GroundedArticleFact[];
  keySentences: ArticleEvidence[];
  entities: Array<{ name: string; kind: "person" | "place" | "organization" | "other" }>;
  topics: Array<{ key: string; label: string }>;
  events: Array<{ id: string; description: string; evidenceId: string }>;
  numericalFacts: Array<{ value: string; context: string; evidenceId: string }>;
  uncertainties: string[];
  tone: ArticleTone;
  confidence: number;
};

export type NewsGroundingSource = "headline" | "feed_summary" | "feed_content" | "article" | "memory" | "inference" | "aguri_opinion" | "imagination" | "unknown";
export type NewsConversationLens = "practical_change" | "people_involved" | "numbers_and_scale" | "learned_word" | "aguri_daily_life" | "uncertainty";

export type NewsBeat = {
  id: string;
  kind: "opening" | "understanding" | "memory" | "interpretation" | "opinion" | "uncertainty" | "imagination" | "question";
  text: string;
  source: NewsGroundingSource;
  evidenceIds: string[];
  emotion: "calm" | "curious" | "happy" | "excited" | "confused" | "lonely";
};

export type PreferenceOwner = "user" | "aguri";

export type CharacterOpinion = {
  id: string;
  owner: PreferenceOwner;
  subjectConceptId?: string | undefined;
  topicKey?: string | undefined;
  polarity: number;
  curiosity: number;
  confidence: number;
  reason: "past_reaction" | "category_tendency" | "learned_attribute" | "relationship" | "current_emotion" | "news_tone" | "unknown";
  createdAt: number;
  updatedAt: number;
};

export type NewsConversationPlan = {
  newsItemId: string;
  contentLevel: ArticleContentLevel;
  openingReaction: NewsBeat;
  understanding: NewsBeat[];
  memoryConnection?: NewsBeat | undefined;
  aguriInterpretation: NewsBeat;
  aguriOpinion: NewsBeat;
  uncertainty?: NewsBeat | undefined;
  imagination?: NewsBeat | undefined;
  userQuestion?: NewsBeat | undefined;
  selectedLens: NewsConversationLens;
  emotionCurve: NewsBeat["emotion"][];
  groundedFactIds: string[];
  conceptIds: string[];
  opinions: CharacterOpinion[];
  pages: NewsBeat[];
};
