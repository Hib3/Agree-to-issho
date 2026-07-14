export const relationTypes = [
  "does_with",
  "done_at",
  "uses",
  "contains",
  "located_at",
  "lives_at",
  "likes",
  "dislikes",
  "wears",
  "eats_drinks",
  "travels_by",
  "associated_with",
  "part_of",
  "causes",
  "prevents",
  "similar_to",
  "opposite_of"
] as const;

export type RelationType = (typeof relationTypes)[number];

export type ConceptRelation = {
  id: string;
  fromConceptId: string;
  toConceptId: string;
  type: RelationType;
  source: "explicit" | "answer" | "story" | "inferred";
  strength: number;
  confidence: number;
  createdAt: number;
  reinforcedAt: number;
};
