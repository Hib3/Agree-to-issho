import type { CharacterEmotion } from "./character";
import type { RelationType } from "./relation";

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

export type QuestionIntent =
  | "relation_discovery"
  | "relation_confirmation"
  | "category_confirmation"
  | "situation_question"
  | "preference_question"
  | "correction_request"
  | "conversation_navigation"
  | "none";

export type CompositionProposition = {
  wordIds: string[];
  frameId: string;
  relationType: "confirmed_relation" | "scene_hypothesis" | "relation_discovery" | "single_word" | "drift_hypothesis";
  relationText: string;
  evidence: "confirmed_relation" | "scene_frame" | "category_only" | "none";
  confidence: number;
  questionIntent: QuestionIntent;
};

export type DialogueAnswerEffect = {
  semanticEffect: "confirm" | "reject" | "unknown" | "preference_like" | "preference_neutral" | "preference_dislike" | "none";
  navigationEffect: "continue" | "close" | "stay" | "none";
  memoryEffect: "link_words" | "unlink_words" | "update_preference" | "update_category" | "none";
  relationType?: RelationType;
  relationDirection?: "forward" | "reverse";
};

export type DialogueChoice = {
  id: string;
  label: string;
  effect: "affirm" | "deny" | "curious" | "later";
  answerEffect?: DialogueAnswerEffect;
};
export type DialogueTurn = {
  id: string;
  speaker: "aguri" | "player";
  page: string;
  emotion: CharacterEmotion;
  conceptIds: string[];
  choices?: DialogueChoice[];
  requiresAnswer: boolean;
  answerSchema: DialogueChoice[];
  semanticKey: string;
  templateId: string;
  usedWordIds: string[];
  styleBasePage: string;
  styledPreview: string;
  validationErrors: string[];
  createdAt: number;
};

export type PendingQuestion = {
  id: string;
  prompt: string;
  choices: DialogueChoice[];
  questionIntent: QuestionIntent;
  answerSchema: DialogueChoice[];
  proposition: CompositionProposition;
  relationDraft?: { fromConceptId: string; toConceptId: string; type: string };
};

export type ConversationSession = {
  schemaVersion: 2;
  dialogueRevision: 2;
  id: string;
  phase: ConversationPhase;
  intent: ConversationIntent;
  locationId: string;
  templateIds: string[];
  slotConceptIds: Record<string, string>;
  topicWordIds: string[];
  proposition: CompositionProposition;
  questionIntent: QuestionIntent;
  history: DialogueTurn[];
  queuedTurns: DialogueTurn[];
  pendingQuestion?: PendingQuestion;
  absurdityCount: number;
  randomSeed: number;
  validationErrors: string[];
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
