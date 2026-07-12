import type { DialogueTemplate, TemplateSlot } from "../../data/schema/dialogue";
import type { Concept } from "../model/concept";
import type { ConversationSession } from "../model/conversation";
import type { RandomSource } from "../../infrastructure/random/random";
import { pickOne } from "../../infrastructure/random/random";

function roleFits(concept: Concept, slot: TemplateSlot) {
  if (!slot.categories.includes(concept.userCategory)) return false;
  const grammar = concept.grammar;
  const roleChecks = {
    subject: grammar.canBeSubject,
    object: grammar.canBeObject,
    location: grammar.canBeLocation,
    action: grammar.suruAction || Boolean(grammar.verbDictionaryForm),
    container: grammar.canBeContainer,
    body_part: concept.userCategory === "body_part",
    companion: grammar.canBeCompanion
  };
  return roleChecks[slot.grammaticalRole];
}

export function resolveSlots(
  template: DialogueTemplate,
  concepts: Concept[],
  recentSessions: ConversationSession[],
  random: RandomSource
): Record<string, Concept> | undefined {
  const active = concepts.filter((concept) => concept.active);
  const recentIds = new Set(recentSessions.slice(-3).flatMap((session) => Object.values(session.slotConceptIds)));
  const result: Record<string, Concept> = {};
  const used = new Set<string>();
  const userCount = active.filter((concept) => concept.source === "user").length;
  let userIncluded = false;
  for (const slot of template.slots) {
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
