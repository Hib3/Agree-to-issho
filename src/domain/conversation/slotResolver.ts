import type { DialogueTemplate, TemplateSlot } from "../../data/schema/dialogue";
import type { Concept } from "../model/concept";
import type { ConversationSession } from "../model/conversation";
import type { ConceptRelation } from "../model/relation";
import type { RandomSource } from "../../infrastructure/random/random";
import { pickOne } from "../../infrastructure/random/random";
import { isConfirmedRelation } from "./semanticComposition";

function roleFits(concept: Concept, slot: TemplateSlot) {
  if (!slot.categories.includes(concept.userCategory)) return false;
  const grammar = concept.grammar;
  const roleChecks = {
    topic: true,
    subject: grammar.canBeSubject,
    object: grammar.canBeObject,
    location: grammar.canBeLocation,
    action: grammar.suruAction || Boolean(grammar.verbDictionaryForm),
    container:
      concept.userCategory === "place" ||
      concept.attributes.usageMode === "contain" ||
      concept.attributes.objectKind === "container",
    body_part: concept.userCategory === "body_part",
    companion: grammar.canBeCompanion
  };
  return roleChecks[slot.grammaticalRole];
}

export function resolveSlots(
  template: DialogueTemplate,
  concepts: Concept[],
  relations: ConceptRelation[],
  recentSessions: ConversationSession[],
  random: RandomSource
): Record<string, Concept> | undefined {
  const active = concepts.filter((concept) => concept.active);
  const recentUseCounts = countRecentUse(recentSessions);
  const strictSolutions = findSolutions(template, active, relations, recentUseCounts, true);
  const solutions =
    strictSolutions.length > 0
      ? strictSolutions
      : findSolutions(template, active, relations, recentUseCounts, false);
  return pickOne(solutions, random);
}

function findSolutions(
  template: DialogueTemplate,
  concepts: Concept[],
  relations: ConceptRelation[],
  recentUseCounts: Map<string, number>,
  enforceRecentLimit: boolean
) {
  const requiredTypes = template.constraints.requiredRelations ?? [];
  const needsConfirmedRelation =
    requiredTypes.length > 0 ||
    (template.grounding === "relation_required" &&
      template.intent !== "ask_relation" &&
      template.intent !== "misunderstanding");
  const confirmedRelations = relations.filter(
    (relation) =>
      isConfirmedRelation(relation) && (requiredTypes.length === 0 || requiredTypes.includes(relation.type))
  );
  if (needsConfirmedRelation && confirmedRelations.length === 0) return [];

  const pools = Object.fromEntries(
    template.slots.map((slot) => [
      slot.name,
      concepts
        .filter((concept) => roleFits(concept, slot))
        .filter(
          (concept) =>
            !enforceRecentLimit ||
            template.constraints.maxRecentUse === undefined ||
            (recentUseCounts.get(concept.id) ?? 0) <= template.constraints.maxRecentUse
        )
        .sort(
          (left, right) =>
            candidatePriority(right, recentUseCounts) - candidatePriority(left, recentUseCounts)
        )
        .slice(0, 12)
    ])
  ) as Record<string, Concept[]>;

  const seeds = needsConfirmedRelation ? relationSeeds(template.slots, concepts, confirmedRelations) : [{}];
  const solutions: Record<string, Concept>[] = [];

  for (const seed of seeds) {
    visitSlots(template, pools, seed, 0, solutions);
    if (solutions.length >= 4) break;
  }
  return deduplicateSolutions(solutions).slice(0, 4);
}

function visitSlots(
  template: DialogueTemplate,
  pools: Record<string, Concept[]>,
  current: Record<string, Concept>,
  index: number,
  solutions: Record<string, Concept>[]
) {
  if (solutions.length >= 4) return;
  if (index >= template.slots.length) {
    const userWords = Object.values(current).filter((concept) => concept.source === "user").length;
    if (userWords >= (template.constraints.minUserWords ?? 0)) solutions.push({ ...current });
    return;
  }

  const slot = template.slots[index]!;
  if (current[slot.name]) {
    visitSlots(template, pools, current, index + 1, solutions);
    return;
  }
  const used = new Set(Object.values(current).map((concept) => concept.id));
  for (const concept of pools[slot.name] ?? []) {
    if (used.has(concept.id)) continue;
    current[slot.name] = concept;
    visitSlots(template, pools, current, index + 1, solutions);
    delete current[slot.name];
    if (solutions.length >= 4) return;
  }
  if (!slot.required) visitSlots(template, pools, current, index + 1, solutions);
}

function relationSeeds(slots: TemplateSlot[], concepts: Concept[], relations: ConceptRelation[]) {
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  const seeds: Record<string, Concept>[] = [];
  for (const relation of relations.sort((left, right) => right.confidence - left.confidence)) {
    const endpoints = [
      [conceptById.get(relation.fromConceptId), conceptById.get(relation.toConceptId)],
      [conceptById.get(relation.toConceptId), conceptById.get(relation.fromConceptId)]
    ] as const;
    for (let firstIndex = 0; firstIndex < slots.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < slots.length; secondIndex += 1) {
        const firstSlot = slots[firstIndex]!;
        const secondSlot = slots[secondIndex]!;
        for (const [first, second] of endpoints) {
          if (!first || !second || !roleFits(first, firstSlot) || !roleFits(second, secondSlot)) continue;
          seeds.push({ [firstSlot.name]: first, [secondSlot.name]: second });
        }
      }
    }
  }
  return deduplicateSolutions(seeds);
}

function countRecentUse(sessions: ConversationSession[]) {
  const counts = new Map<string, number>();
  for (const session of sessions.slice(-8)) {
    for (const id of new Set(Object.values(session.slotConceptIds))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

function candidatePriority(concept: Concept, recentUseCounts: Map<string, number>) {
  return (
    (concept.source === "user" ? 100 : 0) - (recentUseCounts.get(concept.id) ?? 0) * 10 - concept.usageCount
  );
}

function deduplicateSolutions(solutions: Record<string, Concept>[]) {
  const unique = new Map<string, Record<string, Concept>>();
  for (const solution of solutions) {
    const key = Object.entries(solution)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([slot, concept]) => `${slot}:${concept.id}`)
      .join("|");
    unique.set(key, solution);
  }
  return [...unique.values()];
}
