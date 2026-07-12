import type { CharacterEmotion } from "./character";

export const conversationIntents = [
  "small_talk",
  "ask_meaning",
  "ask_preference",
  "ask_relation",
  "recall_memory",
  "rumor",
  "observation",
  "warning",
  "invitation",
  "discovery",
  "comparison",
  "daydream",
  "misunderstanding",
  "outing_report",
  "quiet_moment"
] as const;

export type ConversationIntent = (typeof conversationIntents)[number];
export type ConversationPhase =
  | "opening"
  | "premise"
  | "question"
  | "awaiting_answer"
  | "reaction"
  | "twist"
  | "closing"
  | "completed";

export type DialogueChoice = { id: string; label: string; effect: "affirm" | "deny" | "curious" | "later" };
export type DialogueTurn = {
  id: string;
  speaker: "aguri" | "player";
  page: string;
  emotion: CharacterEmotion;
  conceptIds: string[];
  choices?: DialogueChoice[];
  createdAt: number;
};

export type PendingQuestion = {
  id: string;
  prompt: string;
  choices: DialogueChoice[];
  relationDraft?: { fromConceptId: string; toConceptId: string; type: string };
};

export type ConversationSession = {
  id: string;
  phase: ConversationPhase;
  intent: ConversationIntent;
  locationId: string;
  templateIds: string[];
  slotConceptIds: Record<string, string>;
  history: DialogueTurn[];
  queuedTurns: DialogueTurn[];
  pendingQuestion?: PendingQuestion;
  absurdityCount: number;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
};

export type DialogueHistoryEntry = DialogueTurn & { sessionId: string; intent: ConversationIntent; locationId: string };

export type ResponseEffect = {
  relationshipDelta: number;
  trustDelta: number;
  moodDelta: number;
  focusedSlot?: string;
  strengthenRelationIds?: string[];
  weakenRelationIds?: string[];
  flags?: string[];
};
