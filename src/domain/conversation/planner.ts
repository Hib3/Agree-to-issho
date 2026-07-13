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
  const byIntent = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const group = byIntent.get(candidate.template.intent) ?? [];
    group.push(candidate);
    byIntent.set(candidate.template.intent, group);
  }
  const intentHeads = [...byIntent.entries()].map(([intent, group]) => ({
    intent,
    score: group[0]?.score ?? Number.NEGATIVE_INFINITY
  }));
  const bestIntentScore = Math.max(...intentHeads.map((item) => item.score));
  const eligibleIntents = intentHeads.filter((item) => item.score >= bestIntentScore - 18);
  const selectedIntent = weightedPick(
    eligibleIntents,
    (item) => Math.max(1, item.score - (bestIntentScore - 18) + 1),
    input.random
  )?.intent;
  const intentCandidates = selectedIntent ? (byIntent.get(selectedIntent) ?? []) : candidates;
  const bestFrameScore = intentCandidates[0]?.score ?? candidates[0]?.score ?? 0;
  const topFrames = intentCandidates.filter((candidate) => candidate.score >= bestFrameScore - 8);
  const selected = pickOne(topFrames, input.random) ?? intentCandidates[0] ?? candidates[0];
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

function weightedPick<T>(items: T[], weightFor: (item: T) => number, random: RandomSource) {
  const weights = items.map((item) => Math.max(0, weightFor(item)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return pickOne(items, random);
  let cursor = random.next() * total;
  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) return items[index];
  }
  return items.at(-1);
}
