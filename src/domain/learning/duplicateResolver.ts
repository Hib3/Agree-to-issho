import { duplicateKey, normalizeJapanese } from "../grammar/japaneseNormalizer";
import type { Concept } from "../model/concept";

export type DuplicateMatch = { concept: Concept; reason: "normalized" | "alias" | "script" | "spacing" | "reading" };

export function findDuplicate(input: string, concepts: Concept[]): DuplicateMatch | undefined {
  const normalized = normalizeJapanese(input);
  const key = duplicateKey(input);
  for (const concept of concepts) {
    if (concept.normalized === normalized) return { concept, reason: "normalized" };
    if (concept.aliases.some((alias) => normalizeJapanese(alias) === normalized)) return { concept, reason: "alias" };
    if (duplicateKey(concept.surface) === key) return { concept, reason: "spacing" };
    if (concept.reading && duplicateKey(concept.reading) === key) return { concept, reason: "reading" };
  }
  return undefined;
}
