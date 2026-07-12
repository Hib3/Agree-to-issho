import type { ResponsePattern } from "../../data/schema/dialogue";
import type { CharacterState } from "../model/character";
import type { ConversationSession, DialogueTurn, PendingQuestion } from "../model/conversation";
import type { RandomSource } from "../../infrastructure/random/random";
import { pickOne } from "../../infrastructure/random/random";
import { realize, splitJapanesePages } from "../grammar/japaneseRealizer";
import { controlledPremise } from "./absurdityController";
import type { ScoredCandidate } from "./scorer";
import { displayConcept } from "../grammar/japaneseRealizer";

export function realizeCandidate(
  candidate: ScoredCandidate,
  responsePatterns: ResponsePattern[],
  character: CharacterState,
  locationId: string,
  now: number,
  random: RandomSource
): ConversationSession {
  const variant = pickOne(candidate.template.variants, random) ?? candidate.template.variants[0] ?? "今日は静かですね。";
  const absurdity = controlledPremise(candidate);
  const realized = realize(variant, candidate.slots);
  if (/\{[^}]+\}/u.test(realized)) throw new Error(`未解決の会話スロットがあります: ${candidate.template.id}`);
  const focus = Object.values(candidate.slots).find((concept) => concept.source === "user") ?? Object.values(candidate.slots)[0];
  if (!focus) throw new Error(`会話に使える言葉がありません: ${candidate.template.id}`);
  const topicIntroduction = focus.source === "user"
    ? `この前教えてもらった「${displayConcept(focus)}」、ノートでまた見つけましたっ。`
    : `今日は「${displayConcept(focus)}」のことを考えていたんです。`;
  const pages = [topicIntroduction, absurdity.premise, ...splitJapanesePages(realized)]
    .filter(Boolean)
    .slice(0, 5);
  const conceptIds = Object.values(candidate.slots).map((concept) => concept.id);
  const history: DialogueTurn[] = [];
  const queuedTurns = pages.map((page, index): DialogueTurn => ({
    id: `turn_${crypto.randomUUID()}`,
    speaker: "aguri",
    page,
    emotion: candidate.template.intent === "misunderstanding" ? "confused" : character.emotion,
    conceptIds,
    createdAt: now + index
  }));
  const patternId = pickOne(candidate.template.responsePatternIds ?? [], random);
  const responsePattern = responsePatterns.find((pattern) => pattern.id === patternId);
  let pendingQuestion: PendingQuestion | undefined;
  if (responsePattern) {
    const surfaces = Object.values(candidate.slots).slice(0, 2).map(displayConcept);
    const subject = surfaces.length > 1 ? `「${surfaces[0]}」と「${surfaces[1]}」` : `「${surfaces[0]}」`;
    const choices = [...responsePattern.choices];
    if (!choices.some((choice) => choice.effect === "affirm")) {
      choices.unshift({ id: `affirm_${crypto.randomUUID()}`, label: "その組み合わせでいい", effect: "affirm" });
    }
    if (!choices.some((choice) => choice.effect === "deny")) {
      choices.push({ id: `deny_${crypto.randomUUID()}`, label: "その組み合わせは違う", effect: "deny" });
    }
    pendingQuestion = {
      id: `question_${crypto.randomUUID()}`,
      prompt: `${subject}をこんなふうに組み合わせても、変じゃないですかっ？`,
      choices
    };
  }
  return {
    id: `session_${crypto.randomUUID()}`,
    phase: "opening",
    intent: candidate.template.intent,
    locationId,
    templateIds: [candidate.template.id],
    slotConceptIds: Object.fromEntries(Object.entries(candidate.slots).map(([key, value]) => [key, value.id])),
    history,
    queuedTurns,
    ...(pendingQuestion ? { pendingQuestion } : {}),
    absurdityCount: absurdity.count,
    startedAt: now,
    updatedAt: now
  };
}
