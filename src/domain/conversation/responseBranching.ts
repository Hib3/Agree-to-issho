import type { CharacterState } from "../model/character";
import type { ConversationSession, DialogueChoice, DialogueTurn, ResponseEffect } from "../model/conversation";
import type { ConceptRelation } from "../model/relation";
import type { Concept } from "../model/concept";
import { displayConcept } from "../grammar/japaneseRealizer";

export function effectForChoice(choice: DialogueChoice, relationIds: string[] = []): ResponseEffect {
  if (choice.effect === "affirm") return { relationshipDelta: 1, trustDelta: 2, moodDelta: 1, strengthenRelationIds: relationIds };
  if (choice.effect === "deny") return { relationshipDelta: 0, trustDelta: 1, moodDelta: -1, weakenRelationIds: relationIds };
  if (choice.effect === "curious") return { relationshipDelta: 1, trustDelta: 1, moodDelta: 1, flags: ["player_curiosity"] };
  return { relationshipDelta: 0, trustDelta: 0, moodDelta: 0, flags: ["topic_later"] };
}

export function applyResponse(
  session: ConversationSession,
  choice: DialogueChoice,
  character: CharacterState,
  relations: ConceptRelation[],
  concepts: Concept[],
  now: number
) {
  const involvedIds = Object.values(session.slotConceptIds);
  const involvedRelations = relations.filter(
    (relation) => involvedIds.includes(relation.fromConceptId) && involvedIds.includes(relation.toConceptId)
  );
  const effect = effectForChoice(choice, involvedRelations.map((relation) => relation.id));
  let updatedRelations = relations.map((relation) => {
    if (effect.strengthenRelationIds?.includes(relation.id)) {
      return { ...relation, strength: Math.min(1, relation.strength + 0.12), reinforcedAt: now };
    }
    if (effect.weakenRelationIds?.includes(relation.id)) {
      return { ...relation, strength: Math.max(0, relation.strength - 0.18), reinforcedAt: now };
    }
    return relation;
  });
  if (choice.effect === "affirm" && involvedIds.length >= 2 && involvedRelations.length === 0) {
    updatedRelations = [...updatedRelations, {
      id: `relation_${crypto.randomUUID()}`,
      fromConceptId: involvedIds[0]!,
      toConceptId: involvedIds[1]!,
      type: "associated_with",
      source: "answer",
      strength: 0.45,
      confidence: 0.7,
      createdAt: now,
      reinforcedAt: now
    }];
  }
  const names = involvedIds
    .map((id) => concepts.find((concept) => concept.id === id))
    .filter((concept): concept is Concept => Boolean(concept))
    .slice(0, 2)
    .map(displayConcept);
  const pair = names.length >= 2 ? `「${names[0]}」と「${names[1]}」` : names[0] ? `「${names[0]}」` : "今の話";
  const reaction: DialogueTurn = {
    id: `turn_${crypto.randomUUID()}`,
    speaker: "aguri",
    page:
      choice.effect === "affirm"
        ? `${pair}は、こんなふうに一緒に考えていいんですねっ！ ノートに覚えておきますっ！`
        : choice.effect === "deny"
          ? `${pair}を同じ線で結ぶのは違うんですねっ！ まァっ、ノートを直しておきますっ！`
          : choice.effect === "curious"
            ? `${pair}のどこが気になったのか、アグリももう少し考えてみますっ！`
            : `${pair}の話は、今日はここまでにしてノートへはさんでおきますっ！`,
    emotion: choice.effect === "deny" ? "embarrassed" : "happy",
    conceptIds: involvedIds,
    createdAt: now
  };
  const { pendingQuestion, ...sessionWithoutQuestion } = session;
  void pendingQuestion;
  return {
    effect,
    character: {
      ...character,
      closeness: clamp(character.closeness + effect.relationshipDelta),
      trust: clamp(character.trust + effect.trustDelta),
      emotion: choice.effect === "deny" ? "embarrassed" as const : "happy" as const,
      updatedAt: now
    },
    relations: updatedRelations,
    session: {
      ...sessionWithoutQuestion,
      phase: "reaction" as const,
      queuedTurns: [...session.queuedTurns, reaction],
      updatedAt: now
    }
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
