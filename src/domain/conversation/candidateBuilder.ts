import type { DialogueTemplate } from "../../data/schema/dialogue";
import type { CharacterState } from "../model/character";
import type { Concept } from "../model/concept";
import type { ConversationSession } from "../model/conversation";
import type { ConceptRelation } from "../model/relation";
import type { RandomSource } from "../../infrastructure/random/random";
import { resolveSlots } from "./slotResolver";
import { scoreCandidate, type ScoredCandidate } from "./scorer";

export function buildCandidates(input: {
  templates: DialogueTemplate[];
  concepts: Concept[];
  relations: ConceptRelation[];
  recentSessions: ConversationSession[];
  character: CharacterState;
  locationId: string;
  random: RandomSource;
}) {
  const candidates: ScoredCandidate[] = [];
  for (const template of input.templates) {
    if (!template.locations.includes(input.locationId)) continue;
    const slots = resolveSlots(template, input.concepts, input.recentSessions, input.random);
    if (!slots) continue;
    candidates.push(
      scoreCandidate(template, slots, input.locationId, input.relations, input.recentSessions, input.character)
    );
  }
  return candidates.sort((a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id));
}
