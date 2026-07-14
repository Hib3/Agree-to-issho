import type { CharacterEmotion } from "../../domain/model/character";
import type { ConceptCategory } from "../../domain/model/concept";
import type { ConversationIntent, ConversationPhase } from "../../domain/model/conversation";
import type { RelationType } from "../../domain/model/relation";

export type GrammaticalRole =
  "topic" | "subject" | "object" | "location" | "action" | "container" | "body_part" | "companion";

export type TemplateSlot = {
  name: string;
  categories: ConceptCategory[];
  grammaticalRole: GrammaticalRole;
  required: boolean;
};

export type DialogueTemplate = {
  id: string;
  semanticFrame: string;
  grounding: "scene_frame" | "relation_required";
  intent: ConversationIntent;
  phase: ConversationPhase;
  locations: string[];
  moods: CharacterEmotion[];
  slots: TemplateSlot[];
  constraints: {
    minUserWords?: number;
    maxRecentUse?: number;
    requiredRelations?: RelationType[];
    forbiddenSameConcept?: string[][];
  };
  variants: string[];
  responsePatternIds?: string[];
  cooldownSessions: number;
};

export type ResponsePattern = {
  id: string;
  kind: "affirm_deny" | "focus" | "correction" | "continue";
  choices: Array<{ id: string; label: string; effect: "affirm" | "deny" | "curious" | "later" }>;
};
