import type { DialogueTemplate, ResponsePattern } from "../../data/schema/dialogue";
import type { CharacterState } from "../model/character";
import type { Concept } from "../model/concept";
import type { ConversationSession } from "../model/conversation";
import type { ConceptRelation } from "../model/relation";
import type { RandomSource } from "../../infrastructure/random/random";
import { pickOne } from "../../infrastructure/random/random";
import { buildCandidates } from "./candidateBuilder";
import { realizeCandidate } from "./realization";
import type { IntentBias } from "./intentPolicy";

export function planConversation(input: {
  templates: DialogueTemplate[];
  responsePatterns: ResponsePattern[];
  concepts: Concept[];
  relations: ConceptRelation[];
  recentSessions: ConversationSession[];
  character: CharacterState;
  locationId: string;
  now: number;
  random: RandomSource;
  randomSeed?: number;
  intentBias?: IntentBias;
}) {
  const candidates = buildCandidates(input);
  if (candidates.length === 0) throw new Error("会話候補を作れませんでした。");
  const bestScore = candidates[0]?.score ?? 0;
  const top = candidates.filter((candidate) => candidate.score >= bestScore - 8).slice(0, 8);
  const selected = pickOne(top, input.random) ?? candidates[0];
  if (!selected) throw new Error("会話候補を選べませんでした。");
  return realizeCandidate(
    selected,
    input.responsePatterns,
    input.relations,
    input.character,
    input.locationId,
    input.now,
    input.random,
    input.randomSeed
  );
}
