import type { ConceptAttributeValue, ConceptAttributes, ConceptCategory } from "../model/concept";
import type { LocationId } from "../model/location";
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
  locationId: LocationId;
  rawInput: string;
  normalizedInput: string;
  duplicateConceptId?: string;
  selectedCategory?: ConceptCategory;
  attributes: ConceptAttributes;
  attributeQuestionIndex: number;
  reading?: string;
  preference?: -2 | -1 | 0 | 1 | 2;
  committedConceptId?: string;
  createdAt: number;
  updatedAt: number;
};

export type LearningEvent =
  | { type: "START"; contextId: LearningContextId; locationId?: LocationId }
  | { type: "ENTER_TEXT"; value: string }
  | { type: "NORMALIZED" }
  | { type: "DUPLICATE_FOUND"; conceptId: string }
  | { type: "NO_DUPLICATE" }
  | { type: "DUPLICATE_SEPARATE" }
  | { type: "SELECT_CATEGORY"; category: ConceptCategory }
  | { type: "ANSWER_ATTRIBUTE"; key: string; value: ConceptAttributeValue; isLast: boolean }
  | { type: "SKIP_ATTRIBUTES" }
  | { type: "SET_ATTRIBUTES"; attributes: ConceptAttributes }
  | { type: "SET_READING"; reading: string }
  | { type: "SET_PREFERENCE"; preference: -2 | -1 | 0 | 1 | 2 }
  | { type: "CONFIRM" }
  | { type: "COMMITTED" }
  | { type: "CELEBRATED" }
  | { type: "RESET" };

export function createLearningSession(
  contextId: LearningContextId,
  now: number,
  locationId: LocationId = "room"
): LearningSession {
  return {
    id: "active",
    state: "contextual_prompt",
    contextId,
    locationId,
    rawInput: "",
    normalizedInput: "",
    attributes: {},
    attributeQuestionIndex: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function transitionLearning(
  session: LearningSession,
  event: LearningEvent,
  now: number
): LearningSession {
  const update = (patch: Partial<LearningSession>) => ({ ...session, ...patch, updatedAt: now });
  switch (event.type) {
    case "START":
      return createLearningSession(event.contextId, now, event.locationId ?? session.locationId ?? "room");
    case "ENTER_TEXT":
      if (!["contextual_prompt", "text_input"].includes(session.state)) return session;
      return update({
        state: "normalize",
        rawInput: event.value,
        normalizedInput: normalizeJapanese(event.value)
      });
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
        ? update({
            state: "category_attributes",
            selectedCategory: event.category,
            attributes: {},
            attributeQuestionIndex: 0
          })
        : session;
    case "ANSWER_ATTRIBUTE":
      return session.state === "category_attributes"
        ? update({
            state: event.isLast ? "preference_question" : "category_attributes",
            attributes: { ...session.attributes, [event.key]: event.value },
            attributeQuestionIndex: event.isLast
              ? session.attributeQuestionIndex
              : (session.attributeQuestionIndex ?? 0) + 1
          })
        : session;
    case "SKIP_ATTRIBUTES":
      return session.state === "category_attributes" ? update({ state: "preference_question" }) : session;
    case "SET_ATTRIBUTES":
      return session.state === "category_attributes"
        ? update({ state: "preference_question", attributes: { ...session.attributes, ...event.attributes } })
        : session;
    case "SET_READING":
      return ["category_attributes", "preference_question", "confirmation"].includes(session.state)
        ? update({ reading: normalizeJapanese(event.reading) })
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
      return createLearningSession(session.contextId, now, session.locationId ?? "room");
  }
}
