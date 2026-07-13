export const conceptCategories = [
  "famous_person",
  "person_name",
  "occupation",
  "person_descriptor",
  "robot",
  "action",
  "required_action",
  "forbidden_action",
  "sport",
  "skill",
  "place",
  "food_drink",
  "living_thing",
  "music",
  "viewable",
  "readable",
  "usable_object",
  "wearable",
  "vehicle",
  "word_expression",
  "body_part",
  "illness",
  "abstract",
  "other"
] as const;

export type ConceptCategory = (typeof conceptCategories)[number];
export type ConceptSource = "starter" | "user";

export type LexicalProfile = {
  partOfSpeech:
    | "common_noun"
    | "proper_noun"
    | "verbal_noun"
    | "verb"
    | "i_adjective"
    | "na_adjective"
    | "expression"
    | "unknown";
  conjugation?: "godan" | "ichidan" | "suru" | "kuru" | "unknown";
  quotePolicy: "mention_only" | "allow_inflection";
  honorificPolicy: "none" | "person_only";
  confidence: number;
};

export type ConceptAttributeValue = string | number | boolean | null;

export type ConceptAttributes = Record<string, ConceptAttributeValue> & {
  honorific?: "none" | "san" | "chan" | "kun" | "sama" | "sensei" | "custom";
  customHonorific?: string;
  personKind?: "known_person" | "public_person" | "fictional_person" | "role_or_title" | "unknown";
  relativeStatus?: "very_above" | "above" | "peer" | "below" | "unknown";
  familiarity?: "close" | "known" | "distant" | "fictional" | "unknown";
  objectKind?: "tool" | "electric" | "container" | "decoration" | "other";
  usageMode?: "use" | "electric" | "wear" | "ride" | "contain" | "display" | "other";
  affordance?: "work" | "play" | "record" | "carry" | "care" | "eat_drink" | "cook" | "rest" | "other";
  importanceWhenMissing?: "essential" | "troublesome" | "replaceable" | "unknown";
  environment?: "inside" | "outside" | "both" | "unknown";
  visitMode?: "often" | "sometimes" | "want_to_go" | "rarely" | "unknown";
  actionContext?: "home" | "outside" | "either" | "unknown";
  socialMode?: "alone" | "together" | "either" | "unknown";
  consumeMode?: "eat" | "drink" | "both";
  mealTime?: "morning" | "day" | "evening" | "snack" | "anytime";
  livingRelation?: "home" | "wild" | "plant" | "imaginary" | "unknown";
  habitat?: "indoors" | "land" | "water" | "sky" | "unknown";
  experienceMode?: "listen" | "perform" | "watch" | "create" | "read" | "write" | "reference" | "other";
  wearArea?: "head" | "body" | "hands" | "feet" | "accessory";
  useContext?: "daily" | "outside" | "formal" | "special" | "unknown";
  powerMode?: "human" | "public" | "motor" | "water_or_air" | "other";
  tripContext?: "daily" | "outing" | "long_trip" | "play" | "other";
  feelingTone?: "positive" | "negative" | "mixed" | "neutral" | "unknown";
};

export type ConceptGrammar = {
  nounLike: boolean;
  suruAction: boolean;
  verbDictionaryForm?: string;
  teForm?: string;
  pastForm?: string;
  negativeForm?: string;
  potentialForm?: string;
  canBeSubject: boolean;
  canBeObject: boolean;
  canBeLocation: boolean;
  canBeContainer: boolean;
  canBeCompanion: boolean;
  canBePossessed: boolean;
};

export type PersonAttributes = {
  displayName: string;
  honorific: "none" | "san" | "chan" | "kun" | "sama" | "sensei" | "custom";
  customHonorific?: string;
  relativeStatus: "very_above" | "above" | "peer" | "below" | "unknown";
  familiarity: "close" | "known" | "distant" | "fictional" | "unknown";
  preference?: -2 | -1 | 0 | 1 | 2;
};

export type Concept = {
  id: string;
  source: ConceptSource;
  surface: string;
  normalized: string;
  reading?: string;
  aliases: string[];
  userCategory: ConceptCategory;
  systemHintCategory?: ConceptCategory;
  categoryConfidence: number;
  preference?: -2 | -1 | 0 | 1 | 2;
  grammar: ConceptGrammar;
  lexicalProfile?: LexicalProfile;
  attributes: ConceptAttributes;
  learnedAt: number;
  lastReviewedAt?: number;
  lastUsedAt?: number;
  usageCount: number;
  reviewCount: number;
  understanding: number;
  ambiguity: number;
  active: boolean;
};

export function isPersonCategory(category: ConceptCategory) {
  return ["famous_person", "person_name", "occupation", "person_descriptor"].includes(category);
}
