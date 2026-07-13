import type { CharacterState } from "../model/character";
import type {
  ConversationSession,
  DialogueAnswerEffect,
  DialogueChoice,
  DialogueTurn,
  ResponseEffect
} from "../model/conversation";
import type { ConceptRelation } from "../model/relation";
import type { Concept } from "../model/concept";
import { displayConcept } from "../grammar/japaneseRealizer";

export function normalizeAnswerEffect(choice: DialogueChoice): DialogueAnswerEffect {
  if (choice.answerEffect) return choice.answerEffect;
  if (choice.effect === "affirm") {
    return { semanticEffect: "confirm", navigationEffect: "none", memoryEffect: "none" };
  }
  if (choice.effect === "deny") {
    return { semanticEffect: "reject", navigationEffect: "none", memoryEffect: "none" };
  }
  if (choice.effect === "curious") {
    return { semanticEffect: "unknown", navigationEffect: "none", memoryEffect: "none" };
  }
  return { semanticEffect: "none", navigationEffect: "close", memoryEffect: "none" };
}

export function effectForChoice(choice: DialogueChoice, relationIds: string[] = []): ResponseEffect {
  const answer = normalizeAnswerEffect(choice);
  if (answer.semanticEffect === "confirm") {
    return { relationshipDelta: 1, trustDelta: 2, moodDelta: 1, strengthenRelationIds: relationIds };
  }
  if (answer.semanticEffect === "reject") {
    return { relationshipDelta: 0, trustDelta: 1, moodDelta: -1, weakenRelationIds: relationIds };
  }
  if (answer.semanticEffect === "unknown") {
    return { relationshipDelta: 1, trustDelta: 1, moodDelta: 0, flags: ["answer_unknown"] };
  }
  if (answer.semanticEffect === "preference_like") {
    return { relationshipDelta: 1, trustDelta: 1, moodDelta: 1, flags: ["preference_learned"] };
  }
  if (answer.semanticEffect === "preference_neutral" || answer.semanticEffect === "preference_dislike") {
    return { relationshipDelta: 0, trustDelta: 1, moodDelta: 0, flags: ["preference_learned"] };
  }
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
  const answer = normalizeAnswerEffect(choice);
  const involvedIds = session.topicWordIds;
  const answerTargetIds = singleWordQuestion(session.questionIntent) ? involvedIds.slice(0, 1) : involvedIds;
  const targetRelationId = session.proposition.relationClaim?.relationId;
  const involvedRelations = targetRelationId
    ? relations.filter((relation) => relation.id === targetRelationId)
    : [];
  const effect = effectForChoice(
    choice,
    involvedRelations.map((relation) => relation.id)
  );
  let updatedRelations = relations.map((relation) => {
    if (answer.memoryEffect === "link_words" && effect.strengthenRelationIds?.includes(relation.id)) {
      return {
        ...relation,
        strength: Math.min(1, relation.strength + 0.12),
        confidence: Math.min(1, relation.confidence + 0.08),
        reinforcedAt: now
      };
    }
    if (answer.memoryEffect === "unlink_words" && effect.weakenRelationIds?.includes(relation.id)) {
      return {
        ...relation,
        strength: Math.max(0, relation.strength - 0.18),
        confidence: Math.max(0, relation.confidence - 0.12),
        reinforcedAt: now
      };
    }
    return relation;
  });
  if (
    session.questionIntent === "relation_discovery" &&
    answer.semanticEffect === "confirm" &&
    answer.memoryEffect === "link_words" &&
    involvedIds.length >= 2
  ) {
    const [firstId, secondId] =
      answer.relationDirection === "reverse"
        ? [involvedIds[1]!, involvedIds[0]!]
        : [involvedIds[0]!, involvedIds[1]!];
    const relationType = answer.relationType ?? "associated_with";
    const existingIndex = updatedRelations.findIndex(
      (relation) =>
        relation.fromConceptId === firstId &&
        relation.toConceptId === secondId &&
        relation.type === relationType
    );
    if (existingIndex >= 0) {
      updatedRelations = updatedRelations.map((relation, index) =>
        index === existingIndex
          ? {
              ...relation,
              strength: Math.min(1, relation.strength + 0.12),
              confidence: Math.min(1, relation.confidence + 0.08),
              reinforcedAt: now
            }
          : relation
      );
    } else {
      updatedRelations = [
        ...updatedRelations,
        {
          id: "relation_" + crypto.randomUUID(),
          fromConceptId: firstId,
          toConceptId: secondId,
          type: relationType,
          source: "answer",
          strength: 0.45,
          confidence: 0.7,
          createdAt: now,
          reinforcedAt: now
        }
      ];
    }
  }

  const names = answerTargetIds
    .map((id) => concepts.find((concept) => concept.id === id))
    .filter((concept): concept is Concept => Boolean(concept))
    .slice(0, 2)
    .map(displayConcept);
  const pair =
    names.length >= 2
      ? "「" + names[0] + "」と「" + names[1] + "」"
      : names[0]
        ? "「" + names[0] + "」"
        : "今の話";
  const updatedConcepts = concepts.map((concept) => {
    if (!answerTargetIds.includes(concept.id) || answer.semanticEffect === "none") return concept;
    const categoryAnswer =
      session.questionIntent === "category_confirmation" &&
      answer.memoryEffect === "update_category" &&
      session.proposition.categoryClaim?.conceptId === concept.id;
    if (categoryAnswer) {
      const confirmed = answer.semanticEffect === "confirm";
      return {
        ...concept,
        categoryConfidence: confirmed
          ? Math.min(1, concept.categoryConfidence + 0.1)
          : Math.max(0, concept.categoryConfidence - 0.25),
        understanding: confirmed
          ? Math.min(1, concept.understanding + 0.08)
          : Math.max(0.2, concept.understanding - 0.04),
        ambiguity: confirmed ? Math.max(0, concept.ambiguity - 0.08) : Math.min(1, concept.ambiguity + 0.18),
        reviewCount: concept.reviewCount + 1,
        lastReviewedAt: now
      };
    }
    const rejectedAttribute =
      session.questionIntent === "attribute_confirmation" &&
      answer.semanticEffect === "reject" &&
      answer.memoryEffect === "update_attribute" &&
      session.proposition.attributeClaim?.conceptId === concept.id;
    if (rejectedAttribute && session.proposition.attributeClaim) {
      return {
        ...concept,
        attributes: { ...concept.attributes, [session.proposition.attributeClaim.key]: "unknown" },
        understanding: Math.max(0.2, concept.understanding - 0.08),
        ambiguity: Math.min(1, concept.ambiguity + 0.18),
        reviewCount: concept.reviewCount + 1,
        lastReviewedAt: now
      };
    }
    const preference =
      answer.semanticEffect === "preference_like"
        ? 2
        : answer.semanticEffect === "preference_neutral"
          ? 0
          : answer.semanticEffect === "preference_dislike"
            ? -2
            : concept.preference;
    const understandingGain =
      answer.semanticEffect === "confirm" ? 0.08 : answer.semanticEffect === "reject" ? 0.05 : 0.03;
    const ambiguityDrop =
      answer.semanticEffect === "reject" ? 0.14 : answer.semanticEffect === "confirm" ? 0.08 : 0.03;
    return {
      ...concept,
      ...(preference === undefined ? {} : { preference }),
      understanding: Math.min(1, concept.understanding + understandingGain),
      ambiguity: Math.max(0, concept.ambiguity - ambiguityDrop),
      reviewCount: concept.reviewCount + 1,
      lastReviewedAt: now
    };
  });
  const reaction = createReaction(session, answer, pair, answerTargetIds, now);
  const { pendingQuestion, ...sessionWithoutQuestion } = session;
  void pendingQuestion;
  return {
    answer,
    effect,
    shouldRecordMemory: answer.semanticEffect !== "none",
    character: {
      ...character,
      closeness: clamp(character.closeness + effect.relationshipDelta),
      trust: clamp(character.trust + effect.trustDelta),
      emotion: answer.semanticEffect === "reject" ? ("embarrassed" as const) : ("happy" as const),
      updatedAt: now
    },
    relations: updatedRelations,
    concepts: updatedConcepts,
    session: {
      ...sessionWithoutQuestion,
      phase: "reaction" as const,
      questionIntent: "none" as const,
      proposition: { ...session.proposition, questionIntent: "none" as const },
      queuedTurns: [...session.queuedTurns, reaction],
      updatedAt: now
    }
  };
}

function createReaction(
  session: ConversationSession,
  answer: DialogueAnswerEffect,
  pair: string,
  involvedIds: string[],
  now: number
): DialogueTurn {
  const page =
    answer.semanticEffect === "preference_like"
      ? pair + "は好きなんですねっ！ 覚えておきますっ！"
      : answer.semanticEffect === "preference_neutral"
        ? pair + "は、今はふつうなんですねっ！"
        : answer.semanticEffect === "preference_dislike"
          ? pair + "は苦手なんですねっ！ 無理に話へ出さないようにしますっ！"
          : answer.semanticEffect === "unknown"
            ? pair + "のことは、まだ分からないまま置いておきますっ！"
            : answer.semanticEffect === "none"
              ? pair + "の話は、今日はここまでにしますっ！"
              : semanticReaction(session, answer, pair);
  return {
    id: "turn_" + crypto.randomUUID(),
    speaker: "aguri",
    page,
    emotion: answer.semanticEffect === "reject" ? "embarrassed" : "happy",
    conceptIds: involvedIds,
    requiresAnswer: false,
    answerSchema: [],
    semanticKey: session.proposition.frameId + ".reaction",
    templateId: session.templateIds[0] ?? "reaction",
    usedWordIds: involvedIds,
    styleBasePage: page,
    styledPreview: page,
    validationErrors: [],
    createdAt: now
  };
}

function semanticReaction(session: ConversationSession, answer: DialogueAnswerEffect, pair: string) {
  if (
    session.questionIntent === "relation_discovery" &&
    answer.semanticEffect === "confirm" &&
    answer.relationType
  ) {
    return pair + "は、" + relationLabel(answer.relationType) + "つながりとして覚えますっ！";
  }
  if (session.questionIntent === "category_confirmation") {
    return answer.semanticEffect === "confirm"
      ? pair + "の種類は、その覚え方で合っているんですねっ！"
      : pair + "の種類は違うんですねっ！ あとで聞き直しますっ！";
  }
  if (session.questionIntent === "attribute_confirmation") {
    const label = session.proposition.attributeClaim?.answerLabel ?? "その答え";
    return answer.semanticEffect === "confirm"
      ? pair + "は「" + label + "」のままで合っているんですねっ！"
      : pair + "の「" + label + "」というメモは、いったん外して聞き直しますっ！";
  }
  if (session.questionIntent === "situation_question") {
    return answer.semanticEffect === "confirm"
      ? pair + "の場面はありそうなんですねっ！"
      : pair + "の場面は違うんですねっ！ 想像のまま覚えないようにしますっ！";
  }
  if (session.questionIntent === "correction_request") {
    return answer.semanticEffect === "confirm"
      ? pair + "の覚え方は合っているんですねっ！"
      : pair + "の覚え方には違う所があるんですねっ！ ノートを直しますっ！";
  }
  return answer.semanticEffect === "confirm"
    ? pair + "には関係があるんですねっ！ ノートに線を足しますっ！"
    : pair + "は関係がないんですねっ！ 勝手に線を結ばないようにしますっ！";
}

function relationLabel(type: NonNullable<DialogueAnswerEffect["relationType"]>) {
  const labels = {
    does_with: "一緒にする",
    done_at: "その場所で行う",
    uses: "使う",
    contains: "中に入っている",
    located_at: "その場所にある",
    lives_at: "その場所で過ごす",
    likes: "好きなものの",
    dislikes: "苦手なものの",
    wears: "身につける",
    eats_drinks: "食べたり飲んだりする",
    travels_by: "それに乗って移動する",
    associated_with: "関係がある",
    part_of: "一部になっている",
    causes: "きっかけになる",
    prevents: "防ぐ",
    similar_to: "似ている",
    opposite_of: "反対に近い"
  } satisfies Record<NonNullable<DialogueAnswerEffect["relationType"]>, string>;
  return labels[type];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function singleWordQuestion(questionIntent: ConversationSession["questionIntent"]) {
  return ["preference_question", "category_confirmation", "attribute_confirmation"].includes(questionIntent);
}
