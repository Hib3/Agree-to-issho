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
  discussionState?: NewsDiscussionState | undefined;
};

export type NewsDiscussionState = "unread" | "prepared" | "discussing" | "discussed" | "dismissed";

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

export type ArticleFetchAttempt = {
  method: "feed_content" | "direct_article" | "reader_helper" | "fallback_headline";
  startedAt: number;
  finishedAt: number;
  result: "success" | "cors_error" | "http_error" | "timeout" | "parse_error" | "too_short" | "disabled";
  statusCode?: number | undefined;
  contentType?: string | undefined;
  extractedCharacters?: number | undefined;
  detail?: string | undefined;
};

export type ArticleFetchTrace = {
  articleUrl: string;
  startedAt: number;
  attempts: ArticleFetchAttempt[];
  finalContentLevel: ArticleContentLevel;
};

export type ArticleIssue = {
  id: string;
  label: string;
  summary: string;
  evidenceIds: string[];
  kind:
    | "change"
    | "cause"
    | "effect"
    | "benefit"
    | "risk"
    | "conflict"
    | "number"
    | "person"
    | "place"
    | "uncertainty";
  importance: number;
  relevanceToUser: number;
  suitabilityForOpinion: number;
};

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
  issues: ArticleIssue[];
  uncertainties: string[];
  tone: ArticleTone;
  confidence: number;
};

export type ArticleFetchResult = {
  digest: ArticleDigest;
  trace: ArticleFetchTrace;
  needsHelperConsent: boolean;
  directFailureReason?: string | undefined;
};

export type NewsDiscussionPreparation =
  | { status: "idle" }
  | { status: "reading_feed"; newsItemId: string }
  | { status: "reading_article"; newsItemId: string }
  | {
      status: "awaiting_helper_consent";
      newsItemId: string;
      directFailureReason: string;
      fallbackDigest: ArticleDigest;
      trace: ArticleFetchTrace;
    }
  | { status: "ready"; newsItemId: string; digest: ArticleDigest; trace: ArticleFetchTrace }
  | {
      status: "failed";
      newsItemId: string;
      fallbackDigest: ArticleDigest;
      reason: string;
      trace: ArticleFetchTrace;
    };

export type NewsGroundingSource =
  | "headline"
  | "feed_summary"
  | "feed_content"
  | "article"
  | "memory"
  | "inference"
  | "aguri_opinion"
  | "imagination"
  | "unknown";
export type NewsConversationLens =
  | "practical_change"
  | "people_involved"
  | "numbers_and_scale"
  | "learned_word"
  | "aguri_daily_life"
  | "uncertainty";

export type NewsBeat = {
  id: string;
  kind:
    | "opening"
    | "understanding"
    | "memory"
    | "interpretation"
    | "opinion"
    | "uncertainty"
    | "imagination"
    | "question";
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
  reason:
    | "past_reaction"
    | "category_tendency"
    | "learned_attribute"
    | "relationship"
    | "current_emotion"
    | "news_tone"
    | "article_issue"
    | "unknown";
  createdAt: number;
  updatedAt: number;
};

export type NewsResponseIntent =
  | "agree"
  | "disagree"
  | "interested"
  | "not_interested"
  | "concerned"
  | "surprised"
  | "personal_relevance"
  | "correct_aguri"
  | "ask_more"
  | "close_topic";

export type EvolvingNewsOpinion = {
  initialOpinion: CharacterOpinion;
  supportingFactIds: string[];
  uncertaintyIds: string[];
  userReaction?: { intent: NewsResponseIntent; conceptIds: string[] } | undefined;
  revisedOpinion?: CharacterOpinion | undefined;
  revisionReason?:
    | "user_agreement"
    | "user_disagreement"
    | "user_correction"
    | "new_personal_connection"
    | "unchanged"
    | undefined;
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
  selectedIssueIds: string[];
  conceptIds: string[];
  opinions: CharacterOpinion[];
  responseQuestion: {
    prompt: string;
    options: Array<{ intent: NewsResponseIntent; label: string }>;
  };
  pages: NewsBeat[];
};
