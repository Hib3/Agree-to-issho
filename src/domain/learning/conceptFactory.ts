import { duplicateKey, normalizeJapanese } from "../grammar/japaneseNormalizer";
import { applyKnownActionGrammar, knownActionLexicalProfile } from "../grammar/actionLexicon";
import type {
  Concept,
  ConceptAttributes,
  ConceptCategory,
  ConceptGrammar,
  LexicalProfile
} from "../model/concept";

export type ConceptDraft = {
  surface: string;
  category: ConceptCategory;
  preference?: -2 | -1 | 0 | 1 | 2;
  attributes?: ConceptAttributes;
  reading?: string;
  lexicalProfile?: LexicalProfile;
};

export function lexicalProfileForCategory(category: ConceptCategory): LexicalProfile {
  const person = ["famous_person", "person_name", "occupation", "person_descriptor"].includes(category);
  if (["action", "required_action", "forbidden_action", "sport", "skill"].includes(category)) {
    return {
      partOfSpeech: "verbal_noun",
      conjugation: "suru",
      quotePolicy: "allow_inflection",
      honorificPolicy: "none",
      confidence: 0.72
    };
  }
  if (category === "word_expression") {
    return {
      partOfSpeech: "expression",
      quotePolicy: "mention_only",
      honorificPolicy: "none",
      confidence: 0.9
    };
  }
  return {
    partOfSpeech: category === "person_name" || category === "famous_person" ? "proper_noun" : "common_noun",
    quotePolicy: "mention_only",
    honorificPolicy: person ? "person_only" : "none",
    confidence: category === "other" ? 0.45 : 0.82
  };
}

export function grammarForCategory(category: ConceptCategory): ConceptGrammar {
  const actionLike = ["action", "required_action", "forbidden_action", "sport", "skill"].includes(category);
  const location = category === "place";
  const object = ["food_drink", "usable_object", "wearable", "vehicle", "readable", "viewable"].includes(
    category
  );
  const person = [
    "famous_person",
    "person_name",
    "occupation",
    "person_descriptor",
    "robot",
    "living_thing"
  ].includes(category);
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

export function createUserConcept(
  draft: ConceptDraft,
  now: number,
  id: string = crypto.randomUUID()
): Concept {
  const surface = normalizeJapanese(draft.surface);
  const actionLike = ["action", "required_action", "forbidden_action", "sport", "skill"].includes(
    draft.category
  );
  const knownGrammar = actionLike
    ? applyKnownActionGrammar(grammarForCategory(draft.category), surface)
    : grammarForCategory(draft.category);
  const knownProfile = actionLike ? knownActionLexicalProfile(surface) : undefined;
  const rawSuru = draft.attributes?.suruAction;
  const explicitSuru = typeof rawSuru === "boolean" ? rawSuru : undefined;
  const { grammar, inferredProfile } = actionLike
    ? applyUserActionPreference(surface, knownGrammar, knownProfile, explicitSuru)
    : { grammar: knownGrammar, inferredProfile: undefined };
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
    lexicalProfile: draft.lexicalProfile ?? inferredProfile ?? lexicalProfileForCategory(draft.category),
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

function applyUserActionPreference(
  surface: string,
  knownGrammar: ConceptGrammar,
  knownProfile: LexicalProfile | undefined,
  explicitSuru: boolean | undefined
) {
  if (explicitSuru === true) {
    return {
      grammar: {
        ...grammarForCategory("action"),
        suruAction: true,
        verbDictionaryForm: `${surface}する`,
        teForm: `${surface}して`,
        pastForm: `${surface}した`,
        negativeForm: `${surface}しない`,
        potentialForm: `${surface}できる`
      },
      inferredProfile: {
        partOfSpeech: "verbal_noun",
        conjugation: "suru",
        quotePolicy: "allow_inflection",
        honorificPolicy: "none",
        confidence: 1
      } satisfies LexicalProfile
    };
  }
  if (explicitSuru === false && knownGrammar.suruAction) {
    return {
      grammar: { ...grammarForCategory("action"), suruAction: false },
      inferredProfile: {
        partOfSpeech: "unknown",
        quotePolicy: "mention_only",
        honorificPolicy: "none",
        confidence: 0.9
      } satisfies LexicalProfile
    };
  }
  return { grammar: knownGrammar, inferredProfile: knownProfile };
}
