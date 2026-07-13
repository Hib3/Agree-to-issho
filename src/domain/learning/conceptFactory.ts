import { duplicateKey, normalizeJapanese } from "../grammar/japaneseNormalizer";
import type { Concept, ConceptAttributes, ConceptCategory, ConceptGrammar } from "../model/concept";

export type ConceptDraft = {
  surface: string;
  category: ConceptCategory;
  preference?: -2 | -1 | 0 | 1 | 2;
  attributes?: ConceptAttributes;
  reading?: string;
};

export function grammarForCategory(category: ConceptCategory): ConceptGrammar {
  const actionLike = ["action", "required_action", "forbidden_action", "sport", "skill"].includes(category);
  const location = category === "place";
  const object = ["food_drink", "usable_object", "wearable", "vehicle", "readable", "viewable"].includes(category);
  const person = ["famous_person", "person_name", "occupation", "person_descriptor", "robot", "living_thing"].includes(category);
  return {
    nounLike: true,
    suruAction: actionLike,
    canBeSubject: person || actionLike || category === "abstract",
    canBeObject: object || actionLike || category === "word_expression",
    canBeLocation: location,
    canBeContainer: location,
    canBeCompanion: person,
    canBePossessed: object || person || category === "body_part"
  };
}

export function createUserConcept(draft: ConceptDraft, now: number, id: string = crypto.randomUUID()): Concept {
  const surface = normalizeJapanese(draft.surface);
  const grammar = grammarForCategory(draft.category);
  if (draft.attributes?.usageMode === "contain" || draft.attributes?.objectKind === "container") {
    grammar.canBeContainer = true;
  }
  const concept: Concept = {
    id: `concept_${id}`,
    source: "user",
    surface,
    normalized: surface,
    aliases: [duplicateKey(surface)],
    userCategory: draft.category,
    categoryConfidence: 1,
    grammar,
    attributes: draft.attributes ?? {},
    learnedAt: now,
    usageCount: 0,
    reviewCount: 0,
    understanding: 0.62,
    ambiguity: 0.38,
    active: true
  };
  if (draft.reading) concept.reading = normalizeJapanese(draft.reading);
  if (draft.preference !== undefined) concept.preference = draft.preference;
  return concept;
}
