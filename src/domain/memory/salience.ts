import type { Concept } from "../model/concept";
import type { MemoryEvent } from "../model/memory";
import type { ConceptRelation } from "../model/relation";

export function memorySalience(
  memory: MemoryEvent,
  concepts: Concept[],
  relations: ConceptRelation[],
  context: { now: number; locationId: string; unansweredConceptIds?: string[] }
) {
  const relatedConcepts = concepts.filter((concept) => memory.conceptIds.includes(concept.id));
  const preference = relatedConcepts.reduce((sum, concept) => sum + Math.abs(concept.preference ?? 0) * 3, 0);
  const density = relations.filter(
    (relation) => memory.conceptIds.includes(relation.fromConceptId) || memory.conceptIds.includes(relation.toConceptId)
  ).length * 2;
  const location = memory.locationId === context.locationId ? 8 : 0;
  const unanswered = memory.conceptIds.some((id) => context.unansweredConceptIds?.includes(id)) ? 10 : 0;
  const recentRecallPenalty = memory.lastRecalledAt && context.now - memory.lastRecalledAt < 3_600_000 ? 30 : 0;
  const ageDays = Math.max(0, context.now - memory.createdAt) / 86_400_000;
  const ageDecay = Math.min(18, ageDays * 0.45);
  return memory.importance * 20 + preference + density + location + unanswered - recentRecallPenalty - ageDecay;
}
