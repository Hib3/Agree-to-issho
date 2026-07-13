import type { DialogueTemplate } from "../../data/schema/dialogue";
import type { Concept } from "../model/concept";
import type { CompositionProposition, DialogueChoice, QuestionIntent } from "../model/conversation";
import type { ConceptRelation, RelationType } from "../model/relation";
import { displayConcept } from "../grammar/japaneseRealizer";

export function isConfirmedRelation(relation: ConceptRelation) {
  return relation.confidence >= 0.6 && ["explicit", "answer"].includes(relation.source);
}

export function composeProposition(input: {
  template: DialogueTemplate;
  slots: Record<string, Concept>;
  relations: ConceptRelation[];
  renderedText: string;
  hasResponse: boolean;
}): CompositionProposition {
  const concepts = Object.values(input.slots);
  const wordIds = concepts.map((concept) => concept.id);
  const relation = input.relations.find(
    (item) =>
      isConfirmedRelation(item) &&
      wordIds.includes(item.fromConceptId) &&
      wordIds.includes(item.toConceptId)
  );

  if (relation) {
    return {
      wordIds,
      frameId: input.template.semanticFrame,
      relationType: input.template.intent === "misunderstanding" ? "drift_hypothesis" : "confirmed_relation",
      relationText: describeRelation(relation, concepts),
      evidence: "confirmed_relation",
      confidence: relation.confidence,
      questionIntent: input.hasResponse
        ? input.template.intent === "misunderstanding"
          ? "correction_request"
          : "relation_confirmation"
        : "none"
    };
  }

  if (
    concepts.length >= 2 &&
    (input.template.grounding === "relation_required" || ["ask_relation", "misunderstanding"].includes(input.template.intent))
  ) {
    return {
      wordIds: wordIds.slice(0, 2),
      frameId: input.template.semanticFrame,
      relationType: "relation_discovery",
      relationText: "",
      evidence: "none",
      confidence: 0,
      questionIntent: "relation_discovery"
    };
  }

  if (concepts.length >= 2) {
    return {
      wordIds,
      frameId: input.template.semanticFrame,
      relationType: "scene_hypothesis",
      relationText: input.renderedText,
      evidence: "scene_frame",
      confidence: 0.55,
      questionIntent: input.hasResponse ? questionIntentFor(input.template.intent, "situation_question") : "none"
    };
  }

  return {
    wordIds: wordIds.slice(0, 1),
    frameId: input.template.semanticFrame,
    relationType: "single_word",
    relationText: "",
    evidence: "none",
    confidence: concepts[0]?.understanding ?? 0,
    questionIntent: input.hasResponse ? questionIntentFor(input.template.intent, "category_confirmation") : "none"
  };
}

export function questionForProposition(proposition: CompositionProposition, concepts: Concept[]) {
  const words = proposition.wordIds
    .map((id) => concepts.find((concept) => concept.id === id))
    .filter((concept): concept is Concept => Boolean(concept))
    .map((concept) => "「" + displayConcept(concept) + "」");
  const pair = words.slice(0, 2).join("と");
  const word = words[0] ?? "その言葉";

  switch (proposition.questionIntent) {
    case "relation_discovery":
      return pair + "には、何か関係がありますか？";
    case "relation_confirmation":
      return proposition.relationText + "として覚えていいですか？";
    case "correction_request":
      return proposition.relationText + "という覚え方に、違う所がありますか？";
    case "preference_question":
      return word + "のこと、好きですか？";
    case "category_confirmation":
      return word + "の種類は、今の覚え方で近いですか？";
    case "situation_question":
      return proposition.relationText + "という場面は、ありそうですか？";
    default:
      return "";
  }
}

export function answerSchemaFor(proposition: CompositionProposition): DialogueChoice[] {
  const choice = (
    id: string,
    label: string,
    effect: DialogueChoice["effect"],
    semanticEffect: NonNullable<DialogueChoice["answerEffect"]>["semanticEffect"],
    memoryEffect: NonNullable<DialogueChoice["answerEffect"]>["memoryEffect"] = "none"
  ): DialogueChoice => ({
    id,
    label,
    effect,
    answerEffect: { semanticEffect, navigationEffect: "none", memoryEffect }
  });

  switch (proposition.questionIntent) {
    case "relation_discovery":
      return [
        choice("relation_yes", "関係がある", "affirm", "confirm", "link_words"),
        choice("relation_no", "関係はない", "deny", "reject"),
        choice("relation_unknown", "まだ分からない", "curious", "unknown")
      ];
    case "relation_confirmation":
      return [
        choice("relation_confirm", "その関係で合ってる", "affirm", "confirm", "link_words"),
        choice("relation_reject", "その関係は違う", "deny", "reject", "unlink_words"),
        choice("relation_unknown", "まだ分からない", "curious", "unknown")
      ];
    case "preference_question":
      return [
        choice("preference_like", "好き", "affirm", "preference_like", "update_preference"),
        choice("preference_neutral", "ふつう", "curious", "preference_neutral", "update_preference"),
        choice("preference_dislike", "苦手", "deny", "preference_dislike", "update_preference")
      ];
    case "situation_question":
      return [
        choice("situation_yes", "ありそう", "affirm", "confirm"),
        choice("situation_no", "その場面は違う", "deny", "reject"),
        choice("situation_unknown", "まだ分からない", "curious", "unknown")
      ];
    case "correction_request":
      return [
        choice("correction_keep", "その覚え方で合ってる", "affirm", "confirm"),
        choice("correction_fix", "そこは違う", "deny", "reject", "unlink_words"),
        choice("correction_unknown", "まだ分からない", "curious", "unknown")
      ];
    case "category_confirmation":
      return [
        choice("category_yes", "その種類で合ってる", "affirm", "confirm", "update_category"),
        choice("category_no", "種類が違う", "deny", "reject", "update_category"),
        choice("category_unknown", "まだ分からない", "curious", "unknown")
      ];
    default:
      return [];
  }
}

function questionIntentFor(intent: DialogueTemplate["intent"], fallback: QuestionIntent): QuestionIntent {
  if (intent === "ask_preference") return "preference_question";
  if (intent === "ask_meaning") return "category_confirmation";
  if (intent === "misunderstanding") return "correction_request";
  return fallback;
}

function describeRelation(relation: ConceptRelation, concepts: Concept[]) {
  const from = concepts.find((concept) => concept.id === relation.fromConceptId);
  const to = concepts.find((concept) => concept.id === relation.toConceptId);
  if (!from || !to) return "";
  const a = "「" + displayConcept(from) + "」";
  const b = "「" + displayConcept(to) + "」";
  const descriptions: Record<RelationType, string> = {
    does_with: a + "は" + b + "と一緒にする",
    done_at: a + "は" + b + "で行う",
    uses: a + "は" + b + "を使う",
    contains: a + "には" + b + "が入る",
    located_at: a + "は" + b + "にある",
    lives_at: a + "は" + b + "にいる",
    likes: a + "は" + b + "が好き",
    dislikes: a + "は" + b + "が苦手",
    wears: a + "は" + b + "を身につける",
    eats_drinks: a + "は" + b + "を食べたり飲んだりする",
    travels_by: a + "は" + b + "で移動する",
    associated_with: a + "と" + b + "は関係がある",
    part_of: a + "は" + b + "の一部",
    causes: a + "は" + b + "のきっかけになる",
    prevents: a + "は" + b + "を防ぐ",
    similar_to: a + "と" + b + "は似ている",
    opposite_of: a + "と" + b + "は反対に近い"
  };
  return descriptions[relation.type];
}
