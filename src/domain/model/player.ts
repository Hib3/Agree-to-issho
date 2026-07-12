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
  autonomousSpeech: boolean;
  updatedAt: number;
};
