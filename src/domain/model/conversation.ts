import type { CharacterEmotion } from "./character";
import type { RelationType } from "./relation";
import type { ConceptCategory } from "./concept";
import type {
  ArticleContentLevel,
  ArticleDigest,
  ArticleFetchTrace,
  EvolvingNewsOpinion,
  NewsDiscussionState,
  NewsResponseIntent
} from "./news";

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
  "opening" | "premise" | "question" | "awaiting_answer" | "reaction" | "twist" | "closing" | "completed";

export const conversationLenses = [
  "memory",
  "observation",
  "social",
  "planning",
  "daydream",
  "retrospective"
] as const;
export type ConversationLens = (typeof conversationLenses)[number];

export const punchlineMechanisms = [
  "reversal",
  "expectation_violation",
  "literal_interpretation",
  "scale_mismatch",
  "mistaken_target",
  "circular_return",
  "overpreparation",
  "delayed_realization",
  "character_flaw_callback",
  "word_attribute_callback",
  "relation_callback"
] as const;
export type PunchlineMechanism = (typeof punchlineMechanisms)[number];

export type NarrativeBeat = {
  kind: "premise" | "setup" | "development" | "turn" | "payoff";
  text: string;
  conceptIds: string[];
  grounding: "confirmed_memory" | "user_attribute" | "scene_hypothesis" | "imagination";
};

export type NarrativePlan = {
  id: string;
  lens: ConversationLens;
  mechanism: PunchlineMechanism;
  focusConceptId: string;
  callbackConceptIds: string[];
  beats: [NarrativeBeat, NarrativeBeat, NarrativeBeat, NarrativeBeat, NarrativeBeat];
  emotionalCurve: CharacterEmotion[];
  evidenceBoundary: "memory" | "typed_attribute" | "hypothesis" | "imagination";
  confidence: number;
  signature: string;
};

export type QuestionIntent =
  | "relation_discovery"
  | "relation_confirmation"
  | "category_confirmation"
  | "attribute_confirmation"
  | "situation_question"
  | "preference_question"
  | "correction_request"
  | "conversation_navigation"
  | "none";

export type CompositionProposition = {
  wordIds: string[];
  frameId: string;
  relationType:
    "confirmed_relation" | "scene_hypothesis" | "relation_discovery" | "single_word" | "drift_hypothesis";
  relationText: string;
  evidence: "confirmed_relation" | "scene_frame" | "category_only" | "none";
  confidence: number;
  questionIntent: QuestionIntent;
  relationClaim?: {
    relationId: string;
    type: RelationType;
    fromConceptId: string;
    toConceptId: string;
  };
  categoryClaim?: {
    conceptId: string;
    category: ConceptCategory;
    label: string;
  };
  attributeClaim?: {
    conceptId: string;
    key: string;
    value: string | number | boolean | null;
    prompt: string;
    answerLabel: string;
  };
};

export type DialogueAnswerEffect = {
  semanticEffect:
    | "confirm"
    | "reject"
    | "unknown"
    | "preference_like"
    | "preference_neutral"
    | "preference_dislike"
    | "none";
  navigationEffect: "continue" | "close" | "stay" | "none";
  memoryEffect:
    "link_words" | "unlink_words" | "update_preference" | "update_category" | "update_attribute" | "none";
  relationType?: RelationType;
  relationDirection?: "forward" | "reverse";
};

export type DialogueChoice = {
  id: string;
  label: string;
  effect: "affirm" | "deny" | "curious" | "later";
  answerEffect?: DialogueAnswerEffect;
  newsResponseIntent?: NewsResponseIntent;
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
  relationDraft?: { fromConceptId: string; toConceptId: string; type: RelationType };
};

export type ConversationOrigin =
  | { type: "ordinary" }
  | {
      type: "news";
      newsItemId: string;
      articleDigest: ArticleDigest;
      sourceUrl: string;
      contentLevel: ArticleContentLevel;
      fetchTrace: ArticleFetchTrace;
      selectedIssueIds: string[];
      groundedFactIds: string[];
      conceptIds: string[];
      memoryIds: string[];
      discussionState: NewsDiscussionState;
      evolvingOpinion: EvolvingNewsOpinion;
      userReaction?: {
        intent: NewsResponseIntent;
        conceptIds: string[];
        recordedAt: number;
      };
      startedAt: number;
      completedAt?: number;
    };

export const CURRENT_DIALOGUE_REVISION = 5 as const;

export type ConversationSession = {
  schemaVersion: 2;
  dialogueRevision: typeof CURRENT_DIALOGUE_REVISION;
  id: string;
  origin: ConversationOrigin;
  phase: ConversationPhase;
  intent: ConversationIntent;
  locationId: string;
  templateIds: string[];
  slotConceptIds: Record<string, string>;
  topicWordIds: string[];
  proposition: CompositionProposition;
  narrativePlan?: NarrativePlan;
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

export type DialogueHistoryEntry = DialogueTurn & {
  sessionId: string;
  intent: ConversationIntent;
  locationId: string;
};

export type ResponseEffect = {
  relationshipDelta: number;
  trustDelta: number;
  moodDelta: number;
  focusedSlot?: string;
  strengthenRelationIds?: string[];
  weakenRelationIds?: string[];
  flags?: string[];
};
