import type { ConceptCategory } from "../model/concept";
import { normalizeJapanese } from "../grammar/japaneseNormalizer";

export const learningStates = [
  "idle",
  "contextual_prompt",
  "text_input",
  "normalize",
  "duplicate_check",
  "duplicate_resolution",
  "category_select",
  "category_attributes",
  "preference_question",
  "confirmation",
  "commit",
  "celebration",
  "completed"
] as const;

export type LearningState = (typeof learningStates)[number];
export type LearningContextId =
  | "room_object"
  | "companion"
  | "wanted_place"
  | "daily_object"
  | "favorite_food"
  | "body"
  | "feeling"
  | "media"
  | "required_action"
  | "forbidden_action";

export type LearningSession = {
  id: "active";
  state: LearningState;
  contextId: LearningContextId;
  rawInput: string;
  normalizedInput: string;
  duplicateConceptId?: string;
  selectedCategory?: ConceptCategory;
  attributes: Record<string, string | number | boolean | null>;
  preference?: -2 | -1 | 0 | 1 | 2;
  createdAt: number;
  updatedAt: number;
};

export type LearningEvent =
  | { type: "START"; contextId: LearningContextId }
  | { type: "ENTER_TEXT"; value: string }
  | { type: "NORMALIZED" }
  | { type: "DUPLICATE_FOUND"; conceptId: string }
  | { type: "NO_DUPLICATE" }
  | { type: "DUPLICATE_SEPARATE" }
  | { type: "SELECT_CATEGORY"; category: ConceptCategory }
  | { type: "SET_ATTRIBUTES"; attributes: Record<string, string | number | boolean | null> }
  | { type: "SET_PREFERENCE"; preference: -2 | -1 | 0 | 1 | 2 }
  | { type: "CONFIRM" }
  | { type: "COMMITTED" }
  | { type: "CELEBRATED" }
  | { type: "RESET" };

export function createLearningSession(contextId: LearningContextId, now: number): LearningSession {
  return {
    id: "active",
    state: "contextual_prompt",
    contextId,
    rawInput: "",
    normalizedInput: "",
    attributes: {},
    createdAt: now,
    updatedAt: now
  };
}

export function transitionLearning(session: LearningSession, event: LearningEvent, now: number): LearningSession {
  const update = (patch: Partial<LearningSession>) => ({ ...session, ...patch, updatedAt: now });
  switch (event.type) {
    case "START":
      return createLearningSession(event.contextId, now);
    case "ENTER_TEXT":
      if (!["contextual_prompt", "text_input"].includes(session.state)) return session;
      return update({ state: "normalize", rawInput: event.value, normalizedInput: normalizeJapanese(event.value) });
    case "NORMALIZED":
      return session.state === "normalize" ? update({ state: "duplicate_check" }) : session;
    case "DUPLICATE_FOUND":
      return session.state === "duplicate_check"
        ? update({ state: "duplicate_resolution", duplicateConceptId: event.conceptId })
        : session;
    case "NO_DUPLICATE":
      return session.state === "duplicate_check" ? update({ state: "category_select" }) : session;
    case "DUPLICATE_SEPARATE": {
      if (session.state !== "duplicate_resolution") return session;
      const { duplicateConceptId, ...withoutDuplicate } = session;
      void duplicateConceptId;
      return { ...withoutDuplicate, state: "category_select", updatedAt: now };
    }
    case "SELECT_CATEGORY":
      return session.state === "category_select"
        ? update({ state: "category_attributes", selectedCategory: event.category })
        : session;
    case "SET_ATTRIBUTES":
      return session.state === "category_attributes"
        ? update({ state: "preference_question", attributes: { ...session.attributes, ...event.attributes } })
        : session;
    case "SET_PREFERENCE":
      return session.state === "preference_question"
        ? update({ state: "confirmation", preference: event.preference })
        : session;
    case "CONFIRM":
      return session.state === "confirmation" ? update({ state: "commit" }) : session;
    case "COMMITTED":
      return session.state === "commit" ? update({ state: "celebration" }) : session;
    case "CELEBRATED":
      return session.state === "celebration" ? update({ state: "completed" }) : session;
    case "RESET":
      return createLearningSession(session.contextId, now);
  }
}
