import type { CharacterEmotion } from "./character";

export type MemoryType =
  | "word_learned"
  | "word_reviewed"
  | "conversation"
  | "outing"
  | "rumor"
  | "discovery"
  | "warning"
  | "meeting"
  | "diary"
  | "player_choice";

export type MemoryEvent = {
  id: string;
  type: MemoryType;
  conceptIds: string[];
  relationIds: string[];
  participantIds: string[];
  locationId: string;
  emotion: CharacterEmotion;
  importance: number;
  createdAt: number;
  lastRecalledAt?: number;
  recallCount: number;
  payload: Record<string, unknown>;
};

export type DiaryEntry = {
  id: string;
  date: string;
  title: string;
  body: string;
  conceptIds: string[];
  memoryIds: string[];
  createdAt: number;
};
