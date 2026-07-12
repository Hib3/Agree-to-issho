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
  attributes: Record<string, string | number | boolean | null>;
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
