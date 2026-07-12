import type { CharacterState } from "../model/character";
import type { Concept } from "../model/concept";
import type { ConversationSession } from "../model/conversation";
import type { ConceptRelation } from "../model/relation";
import type { DialogueTemplate } from "../../data/schema/dialogue";

export const SCORE = {
  contextMatch: 35,
  categoryFit: 30,
  relationFit: 24,
  memorySalienceMax: 20,
  preferenceIntensityMax: 10,
  novelty: 15,
  characterTopicBias: 8,
  learnedWord: 90,
  recentTemplate: -100,
  recentConcept: -45,
  repeatedTuple: -100,
  repeatedIntent: -60,
  grammarRisk: -25
} as const;

export type ScoredCandidate = {
  template: DialogueTemplate;
  slots: Record<string, Concept>;
  score: number;
  tupleKey: string;
  reasons: string[];
};

export function scoreCandidate(
  template: DialogueTemplate,
  slots: Record<string, Concept>,
  locationId: string,
  relations: ConceptRelation[],
  recentSessions: ConversationSession[],
  character: CharacterState
): ScoredCandidate {
  let score = 0;
  const reasons: string[] = [];
  const concepts = Object.values(slots);
  const ids = concepts.map((concept) => concept.id);
  const tupleKey = [...ids].sort().join("|");
  if (template.locations.includes(locationId)) {
    score += SCORE.contextMatch;
    reasons.push("location");
  }
  score += template.slots.length * SCORE.categoryFit;
  if (relations.some((relation) => ids.includes(relation.fromConceptId) && ids.includes(relation.toConceptId))) {
    score += SCORE.relationFit;
    reasons.push("relation");
  }
  score += Math.min(SCORE.memorySalienceMax, concepts.reduce((sum, concept) => sum + concept.understanding * 4, 0));
  score += Math.min(SCORE.preferenceIntensityMax, concepts.reduce((sum, concept) => sum + Math.abs(concept.preference ?? 0) * 2, 0));
  if (concepts.some((concept) => concept.source === "user")) {
    score += SCORE.learnedWord;
    reasons.push("learned-word");
  }
  if (concepts.some((concept) => concept.usageCount === 0)) score += SCORE.novelty;
  score += Math.round(character.curiosity * SCORE.characterTopicBias);
  if (recentSessions.slice(-8).some((session) => session.templateIds.includes(template.id))) score += SCORE.recentTemplate;
  const recentConceptIds = new Set(recentSessions.slice(-3).flatMap((session) => Object.values(session.slotConceptIds)));
  if (ids.some((id) => recentConceptIds.has(id))) score += SCORE.recentConcept;
  const recentTuples = recentSessions.slice(-20).map((session) => Object.values(session.slotConceptIds).sort().join("|"));
  if (recentTuples.includes(tupleKey)) score += SCORE.repeatedTuple;
  if (recentSessions.slice(-3).every((session) => session.intent === template.intent) && recentSessions.length >= 3) {
    score += SCORE.repeatedIntent;
  }
  if (concepts.some((concept) => concept.ambiguity > 0.75)) score += SCORE.grammarRisk;
  return { template, slots, score, tupleKey, reasons };
}
