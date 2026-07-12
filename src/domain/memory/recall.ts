import type { Concept } from "../model/concept";
import type { MemoryEvent } from "../model/memory";
import type { ConceptRelation } from "../model/relation";
import type { RandomSource } from "../../infrastructure/random/random";
import { pickOne } from "../../infrastructure/random/random";
import { memorySalience } from "./salience";

export function selectMemoryForRecall(
  memories: MemoryEvent[],
  concepts: Concept[],
  relations: ConceptRelation[],
  context: { now: number; locationId: string },
  random: RandomSource
) {
  const scored = memories
    .map((memory) => ({ memory, score: memorySalience(memory, concepts, relations, context) }))
    .sort((a, b) => b.score - a.score);
  const threshold = scored[0]?.score ?? 0;
  return pickOne(scored.filter((item) => item.score >= threshold - 5).slice(0, 5), random)?.memory;
}
