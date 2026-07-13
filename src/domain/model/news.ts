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

export type NewsItem = {
  id: string;
  feedId: string;
  sourceName: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: number;
  fetchedAt: number;
  discussedAt?: number | undefined;
};

export type NewsRefreshReport = {
  checkedFeeds: number;
  successfulFeeds: number;
  addedItems: number;
  errors: string[];
};
