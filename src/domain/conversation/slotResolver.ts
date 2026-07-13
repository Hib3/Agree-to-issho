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
    container: concept.userCategory === "place" || concept.attributes.usageMode === "contain" || concept.attributes.objectKind === "container",
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
  const recentIds = new Set(recentSessions.slice(-3).flatMap((session) => Object.values(session.slotConceptIds)));
  const result: Record<string, Concept> = {};
  const used = new Set<string>();
  const userCount = active.filter((concept) => concept.source === "user").length;
  let userIncluded = false;
  let confirmedPairIncluded = false;
  let startIndex = 0;
  const firstSlot = template.slots[0];
  const secondSlot = template.slots[1];
  if (firstSlot && secondSlot) {
    const confirmed = relations
      .filter(isConfirmedRelation)
      .sort((a, b) => b.confidence - a.confidence)
      .flatMap((relation) => [
        [relation.fromConceptId, relation.toConceptId],
        [relation.toConceptId, relation.fromConceptId]
      ]);
    for (const [firstId, secondId] of confirmed) {
      const first = active.find((concept) => concept.id === firstId);
      const second = active.find((concept) => concept.id === secondId);
      if (!first || !second || !roleFits(first, firstSlot) || !roleFits(second, secondSlot)) continue;
      result[firstSlot.name] = first;
      result[secondSlot.name] = second;
      used.add(first.id);
      used.add(second.id);
      userIncluded = first.source === "user" || second.source === "user";
      confirmedPairIncluded = true;
      startIndex = 2;
      break;
    }
  }

  if (
    template.grounding === "relation_required" &&
    !confirmedPairIncluded &&
    template.intent !== "ask_relation" &&
    template.intent !== "misunderstanding"
  ) {
    return undefined;
  }

  for (const slot of template.slots.slice(startIndex)) {
    let pool = active.filter((concept) => !used.has(concept.id) && roleFits(concept, slot) && !recentIds.has(concept.id));
    if (userCount > 0 && !userIncluded) {
      const userPool = pool.filter((concept) => concept.source === "user");
      if (userPool.length > 0) pool = userPool;
    }
    const selected = pickOne(pool, random);
    if (!selected) {
      if (slot.required) return undefined;
      continue;
    }
    result[slot.name] = selected;
    used.add(selected.id);
    userIncluded ||= selected.source === "user";
  }
  if (template.constraints.minUserWords && Object.values(result).filter((concept) => concept.source === "user").length < template.constraints.minUserWords) {
    return undefined;
  }
  return result;
}
