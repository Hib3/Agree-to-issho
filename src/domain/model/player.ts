import type { NewsFeedConfig } from "./news";

export type PlayerProfile = {
  id: "local";
  name: string;
  callName: string;
  createdAt: number;
  updatedAt: number;
};

export type GameSettings = {
  id: "local";
  textSpeed: "slow" | "normal" | "fast";
  fontScale: "small" | "normal" | "large";
  highContrast: boolean;
  reducedMotion: boolean;
  volume: number;
  muted: boolean;
  audioRevision: 1;
  autonomousSpeech: boolean;
  newsEnabled: boolean;
  newsRefreshMinutes: 15 | 30 | 60 | 180;
  newsUseFeedDiscoveryHelper: boolean;
  newsUseFeedFetchHelper: boolean;
  newsUseArticleHelper: boolean;
  newsFeeds: NewsFeedConfig[];
  updatedAt: number;
};
