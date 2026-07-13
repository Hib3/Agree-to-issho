import type { DialogueTemplate } from "../../data/schema/dialogue";
import { isPersonCategory, type Concept } from "../model/concept";
import type { CompositionProposition, DialogueAnswerEffect, DialogueChoice, QuestionIntent } from "../model/conversation";
import type { ConceptRelation, RelationType } from "../model/relation";
import { displayConcept } from "../grammar/japaneseRealizer";
import { answerLabel, attributeQuestionsForCategory } from "../learning/attributeQuestions";

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

  if (concepts.length >= 2 && input.template.intent === "misunderstanding") {
    return {
      wordIds,
      frameId: input.template.semanticFrame,
      relationType: "drift_hypothesis",
      relationText: input.renderedText,
      evidence: relation ? "confirmed_relation" : "category_only",
      confidence: relation ? Math.min(0.65, relation.confidence) : 0.35,
      questionIntent: input.hasResponse ? "correction_request" : "none"
    };
  }

  if (concepts.length >= 2 && input.template.grounding === "scene_frame") {
    return {
      wordIds,
      frameId: input.template.semanticFrame,
      relationType: "scene_hypothesis",
      relationText: input.renderedText,
      evidence: relation ? "confirmed_relation" : "category_only",
      confidence: relation ? Math.min(0.75, relation.confidence) : 0.45,
      questionIntent: input.hasResponse ? questionIntentFor(input.template.intent, "situation_question") : "none"
    };
  }

  if (relation) {
    return {
      wordIds,
      frameId: input.template.semanticFrame,
      relationType: "confirmed_relation",
      relationText: describeRelation(relation, concepts),
      evidence: "confirmed_relation",
      confidence: relation.confidence,
      questionIntent: input.hasResponse
        ? "relation_confirmation"
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

  const singleConcept = concepts[0];
  const attributeClaim = input.hasResponse && input.template.intent === "ask_meaning" && singleConcept
    ? attributeClaimFor(singleConcept)
    : undefined;
  const singleQuestionIntent = attributeClaim
    ? "attribute_confirmation" as const
    : input.hasResponse
      ? questionIntentFor(
          input.template.intent,
          input.template.semanticFrame.endsWith(".single_topic") ? "category_confirmation" : "situation_question"
        )
      : "none" as const;
  return {
    wordIds: wordIds.slice(0, 1),
    frameId: input.template.semanticFrame,
    relationType: "single_word",
    relationText: "",
    evidence: "none",
    confidence: concepts[0]?.understanding ?? 0,
    questionIntent: singleQuestionIntent,
    ...(attributeClaim ? { attributeClaim } : {})
  };
}

function attributeClaimFor(concept: Concept): NonNullable<CompositionProposition["attributeClaim"]> | undefined {
  const claims = attributeQuestionsForCategory(concept.userCategory)
    .filter((question) => {
      const value = concept.attributes[question.key];
      return value !== undefined && value !== null && value !== "" && value !== "unknown";
    })
    .map((question) => ({
      conceptId: concept.id,
      key: question.key,
      value: concept.attributes[question.key] ?? null,
      prompt: question.prompt,
      answerLabel: answerLabel(question, concept.attributes[question.key])
    }));
  return claims[concept.reviewCount % Math.max(1, claims.length)];
}

export function questionForProposition(proposition: CompositionProposition, concepts: Concept[]) {
  const words = proposition.wordIds
    .map((id) => concepts.find((concept) => concept.id === id))
    .filter((concept): concept is Concept => Boolean(concept))
    .map((concept) => "「" + displayConcept(concept) + "」");
  const pair = words.slice(0, 2).join("と");
  const word = words[0] ?? "その言葉";
  const namedTopics = words.join("・");

  switch (proposition.questionIntent) {
    case "relation_discovery":
      return pair + "には、何か関係がありますか？";
    case "relation_confirmation":
      return proposition.relationText + "として覚えていいですか？";
    case "correction_request":
      return namedTopics + "を使った今の覚え方に、違う所がありますか？";
    case "preference_question":
      return word + "のこと、好きですか？";
    case "category_confirmation":
      return word + "の種類は、今の覚え方で近いですか？";
    case "attribute_confirmation":
      return proposition.attributeClaim
        ? `${word}のメモを確かめます。「${proposition.attributeClaim.prompt}」には「${proposition.attributeClaim.answerLabel}」と答えてくれました。今も合っていますか？`
        : `${word}の覚え方を、もう一度教えてもらえますか？`;
    case "situation_question":
      return namedTopics + "を使った場面として、今の想像は近いですか？";
    default:
      return "";
  }
}

export function answerSchemaFor(proposition: CompositionProposition, concepts: Concept[] = []): DialogueChoice[] {
  const choice = (
    id: string,
    label: string,
    effect: DialogueChoice["effect"],
    semanticEffect: NonNullable<DialogueChoice["answerEffect"]>["semanticEffect"],
    memoryEffect: NonNullable<DialogueChoice["answerEffect"]>["memoryEffect"] = "none",
    relation?: Pick<DialogueAnswerEffect, "relationType" | "relationDirection">
  ): DialogueChoice => ({
    id,
    label,
    effect,
    answerEffect: { semanticEffect, navigationEffect: "none", memoryEffect, ...relation }
  });

  switch (proposition.questionIntent) {
    case "relation_discovery":
      return [
        ...relationChoicesFor(proposition, concepts).map((item, index) =>
          choice(`relation_type_${index}`, item.label, "affirm", "confirm", "link_words", item)
        ),
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
    case "attribute_confirmation":
      return [
        choice("attribute_yes", "今も合ってる", "affirm", "confirm"),
        choice("attribute_no", "今は違う", "deny", "reject", "update_attribute"),
        choice("attribute_unknown", "まだ分からない", "curious", "unknown")
      ];
    default:
      return [];
  }
}

function relationChoicesFor(proposition: CompositionProposition, concepts: Concept[]) {
  const pair = proposition.wordIds.slice(0, 2).map((id) => concepts.find((concept) => concept.id === id));
  const first = pair[0];
  const second = pair[1];
  const choices: Array<{ label: string; relationType: RelationType; relationDirection: "forward" | "reverse" }> = [];
  if (!first || !second) return [{ label: "関係がある", relationType: "associated_with" as const, relationDirection: "forward" as const }];

  const add = (label: string, relationType: RelationType, from: Concept, to: Concept) => {
    const relationDirection = from.id === first.id && to.id === second.id ? "forward" as const : "reverse" as const;
    if (!choices.some((item) => item.relationType === relationType && item.relationDirection === relationDirection)) {
      choices.push({ label, relationType, relationDirection });
    }
  };
  const actionLike = (concept: Concept) => ["action", "required_action", "forbidden_action", "sport", "skill"].includes(concept.userCategory);
  const personLike = (concept: Concept) => isPersonCategory(concept.userCategory) || ["robot", "living_thing"].includes(concept.userCategory);
  const objectLike = (concept: Concept) => ["food_drink", "usable_object", "wearable", "vehicle", "readable", "viewable"].includes(concept.userCategory);

  for (const [left, right] of [[first, second], [second, first]] as const) {
    if (actionLike(left) && right.userCategory === "place") add("そこで行う", "done_at", left, right);
    if (personLike(left) && right.userCategory === "place") add("そこで過ごす", "lives_at", left, right);
    if (personLike(left) && right.userCategory === "food_drink") {
      add("食べたり飲んだりする", "eats_drinks", left, right);
      add("好きなもの", "likes", left, right);
    }
    if (personLike(left) && right.userCategory === "wearable") add("身につける", "wears", left, right);
    if (personLike(left) && objectLike(right) && right.userCategory !== "wearable" && right.userCategory !== "food_drink") {
      add("それを使う", "uses", left, right);
    }
    if (actionLike(left) && objectLike(right)) add("それを使う", "uses", left, right);
    if (left.userCategory === "place" && objectLike(right)) add("そこにある", "located_at", right, left);
    if ((left.attributes.usageMode === "contain" || left.attributes.objectKind === "container") && objectLike(right)) {
      add("中に入っている", "contains", left, right);
    }
  }
  if ([first.userCategory, second.userCategory].every((category) => ["abstract", "word_expression", "other"].includes(category))) {
    add("少し似ている", "similar_to", first, second);
    add("反対に近い", "opposite_of", first, second);
  }
  if (choices.length < 3) add("ほかの関係", "associated_with", first, second);
  return choices.slice(0, 3);
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
