import type { LocationId } from "./location";

export type CharacterEmotion =
  | "calm"
  | "curious"
  | "happy"
  | "excited"
  | "embarrassed"
  | "confused"
  | "lonely"
  | "sleepy";

export type CharacterState = {
  id: "aguri";
  name: string;
  emotion: CharacterEmotion;
  energy: number;
  closeness: number;
  curiosity: number;
  socialNeed: number;
  trust: number;
  boredom: number;
  currentLocationId: LocationId;
  lastUserInteractionAt: number;
  lastSpeechAt: number;
  updatedAt: number;
};
