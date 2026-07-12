export type LocationId = "room" | "street" | "rooftop";

export type Location = {
  id: LocationId;
  name: string;
  description: string;
  preferredIntents: ConversationIntent[];
  timeWindows: Array<"morning" | "day" | "evening" | "night">;
  autoSpeechRangeSeconds: readonly [number, number];
  npcCandidates: string[];
};

import type { ConversationIntent } from "./conversation";
