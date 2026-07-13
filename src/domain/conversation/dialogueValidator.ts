import type {
  CompositionProposition,
  ConversationSession,
  DialogueChoice,
  DialogueTurn,
  QuestionIntent
} from "../model/conversation";
import { CURRENT_DIALOGUE_REVISION } from "../model/conversation";

const exposedValues = /\{[^}]+\}|undefined|null|NaN|\[object Object\]/u;
const bareReferences = /(こんなふうに|こんな風に|このように|このつながり|この組み合わせ|この二つ|この三つ|^(これ|それ|あれ)[はをが])/u;

export function validateDialogueTurn(turn: DialogueTurn, proposition: CompositionProposition) {
  const errors: string[] = [];
  if (!turn.page.trim()) errors.push("empty_text");
  if (exposedValues.test(turn.page)) errors.push("exposed_runtime_value");
  if (turn.requiresAnswer && bareReferences.test(turn.page) && !/「[^」]+」/u.test(turn.page)) errors.push("bare_reference");
  if (turn.requiresAnswer && proposition.questionIntent === "none") errors.push("answer_without_question_intent");
  if (turn.requiresAnswer && turn.answerSchema.length === 0) errors.push("missing_answer_schema");
  if (turn.usedWordIds.some((id) => !proposition.wordIds.includes(id))) errors.push("used_word_outside_proposition");
  errors.push(...validateAnswerSchema(proposition.questionIntent, turn.answerSchema));
  return [...new Set(errors)];
}

export function validateConversationSession(session: ConversationSession) {
  const errors: string[] = [];
  if (session.schemaVersion !== 2) errors.push("legacy_schema");
  if (session.dialogueRevision !== CURRENT_DIALOGUE_REVISION) errors.push("legacy_dialogue_revision");
  if (!session.proposition) errors.push("missing_proposition");
  if (session.topicWordIds.join("|") !== session.proposition.wordIds.join("|")) errors.push("topic_words_mismatch");
  if (session.questionIntent !== session.proposition.questionIntent) errors.push("question_intent_mismatch");
  if (session.proposition.evidence === "none" && session.proposition.relationType === "scene_hypothesis") errors.push("ungrounded_scene");
  if (session.phase === "awaiting_answer") {
    if (!session.pendingQuestion) errors.push("missing_pending_question");
    if (session.questionIntent === "none") errors.push("awaiting_without_question_intent");
  }
  if (["relation_discovery", "relation_confirmation"].includes(session.questionIntent) && session.topicWordIds.length < 2) {
    errors.push("relation_question_needs_two_words");
  }
  if (session.questionIntent === "relation_confirmation" && !session.proposition.relationText) {
    errors.push("relation_confirmation_without_text");
  }
  if (session.questionIntent === "attribute_confirmation") {
    if (!session.proposition.attributeClaim) errors.push("attribute_confirmation_without_claim");
    if (session.proposition.attributeClaim && !session.topicWordIds.includes(session.proposition.attributeClaim.conceptId)) {
      errors.push("attribute_claim_outside_topic");
    }
  }
  if (session.pendingQuestion) {
    if (session.pendingQuestion.questionIntent !== session.questionIntent) errors.push("pending_question_intent_mismatch");
    if (bareReferences.test(session.pendingQuestion.prompt) && !/「[^」]+」/u.test(session.pendingQuestion.prompt)) {
      errors.push("bare_question_reference");
    }
    errors.push(...validateAnswerSchema(session.questionIntent, session.pendingQuestion.answerSchema));
  }
  for (const turn of [...session.history, ...session.queuedTurns]) {
    errors.push(...validateDialogueTurn(turn, session.proposition));
  }
  return [...new Set(errors)];
}

export function validateStylePreservation(base: string, styled: string, usedWords: string[], questionIntent: QuestionIntent) {
  const errors: string[] = [];
  for (const word of usedWords) if (base.includes(word) && !styled.includes(word)) errors.push("style_removed_word");
  if (/(ない|ません|違う)/u.test(base) && !/(ない|ません|違う)/u.test(styled)) errors.push("style_removed_negation");
  if (questionIntent !== "none" && /[？?]/u.test(base) && !/[？?]/u.test(styled)) errors.push("style_removed_question");
  return errors;
}

export function validateAnswerSchema(questionIntent: QuestionIntent, choices: DialogueChoice[]) {
  const errors: string[] = [];
  const semanticByIntent: Record<QuestionIntent, Set<string>> = {
    relation_discovery: new Set(["confirm", "reject", "unknown"]),
    relation_confirmation: new Set(["confirm", "reject", "unknown"]),
    category_confirmation: new Set(["confirm", "reject", "unknown"]),
    attribute_confirmation: new Set(["confirm", "reject", "unknown"]),
    situation_question: new Set(["confirm", "reject", "unknown"]),
    preference_question: new Set(["preference_like", "preference_neutral", "preference_dislike"]),
    correction_request: new Set(["confirm", "reject", "unknown"]),
    conversation_navigation: new Set(["none"]),
    none: new Set()
  };
  const memoryByIntent: Record<QuestionIntent, Set<string>> = {
    relation_discovery: new Set(["link_words", "none"]),
    relation_confirmation: new Set(["link_words", "unlink_words", "none"]),
    category_confirmation: new Set(["update_category", "none"]),
    attribute_confirmation: new Set(["update_attribute", "none"]),
    situation_question: new Set(["none"]),
    preference_question: new Set(["update_preference"]),
    correction_request: new Set(["unlink_words", "none"]),
    conversation_navigation: new Set(["none"]),
    none: new Set(["none"])
  };
  for (const choice of choices) {
    const effect = choice.answerEffect;
    if (!effect) {
      errors.push("missing_answer_effect");
      continue;
    }
    if (effect.semanticEffect === "none" && effect.memoryEffect !== "none") errors.push("navigation_changes_memory");
    if (!semanticByIntent[questionIntent].has(effect.semanticEffect)) errors.push("answer_intent_mismatch");
    if (!memoryByIntent[questionIntent].has(effect.memoryEffect)) errors.push("memory_intent_mismatch");
    if (questionIntent === "conversation_navigation" && effect.navigationEffect === "none") errors.push("navigation_answer_without_navigation");
    if (questionIntent !== "conversation_navigation" && effect.navigationEffect !== "none") errors.push("semantic_answer_changes_navigation");
    if (questionIntent.startsWith("relation_") && effect.semanticEffect.startsWith("preference_")) {
      errors.push("relation_has_preference_answer");
    }
    if (questionIntent === "preference_question" && ["link_words", "unlink_words"].includes(effect.memoryEffect)) {
      errors.push("preference_changes_relation");
    }
  }
  return errors;
}
