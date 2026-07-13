import type { ResponsePattern } from "../../data/schema/dialogue";
import type { CharacterState } from "../model/character";
import type {
  CompositionProposition,
  ConversationIntent,
  ConversationSession,
  DialogueTurn,
  PendingQuestion
} from "../model/conversation";
import { CURRENT_DIALOGUE_REVISION } from "../model/conversation";
import type { Concept } from "../model/concept";
import type { ConceptRelation } from "../model/relation";
import type { RandomSource } from "../../infrastructure/random/random";
import { pickOne } from "../../infrastructure/random/random";
import { realize, splitJapanesePages, displayConcept } from "../grammar/japaneseRealizer";
import { applyAguriVoice } from "../voice/aguriVoice";
import { buildNarrative } from "./narrativeGenerator";
import type { ScoredCandidate } from "./scorer";
import { answerSchemaFor, composeProposition, questionForProposition } from "./semanticComposition";
import { validateConversationSession, validateStylePreservation } from "./dialogueValidator";

export function realizeCandidate(
  candidate: ScoredCandidate,
  responsePatterns: ResponsePattern[],
  relations: ConceptRelation[],
  character: CharacterState,
  locationId: string,
  now: number,
  random: RandomSource,
  randomSeed = 0
): ConversationSession {
  const variant =
    pickOne(candidate.template.variants, random) ?? candidate.template.variants[0] ?? "今日は静かですね。";
  const rendered = realize(variant, candidate.slots);
  if (/\{[^}]+\}/u.test(rendered))
    throw new Error("未解決の会話スロットがあります: " + candidate.template.id);
  const configuredPattern = responsePatterns.find((pattern) =>
    (candidate.template.responsePatternIds ?? []).includes(pattern.id)
  );
  const proposition = composeProposition({
    template: candidate.template,
    slots: candidate.slots,
    relations,
    renderedText: rendered,
    hasResponse: Boolean(configuredPattern)
  });
  const allConcepts = Object.values(candidate.slots);
  const usedConcepts = proposition.wordIds
    .map((id) => allConcepts.find((concept) => concept.id === id))
    .filter((concept): concept is Concept => Boolean(concept));
  const focus = usedConcepts.find((concept) => concept.source === "user") ?? usedConcepts[0];
  if (!focus) throw new Error("会話に使える言葉がありません: " + candidate.template.id);

  const narrative = buildNarrative({ candidate, proposition, rendered, random, character });
  const storyPages = narrative.pages;
  const splitPages = storyPages.flatMap((page) => splitJapanesePages(page)).filter(Boolean);
  const pages =
    splitPages.length <= 6
      ? splitPages
      : storyPages.length <= 6
        ? storyPages
        : [...storyPages.slice(0, 5), storyPages.at(-1)!];
  const emotion = emotionForIntent(candidate.template.intent, character);
  const wordSurfaces = usedConcepts.map(displayConcept);
  const queuedTurns = pages.map((page, index) =>
    createTurn({
      page,
      emotion: index === 0 && emotion === "confused" ? "curious" : emotion,
      proposition,
      templateId: candidate.template.id,
      semanticKey: candidate.template.semanticFrame,
      wordSurfaces,
      now: now + index
    })
  );

  const answerSchema = answerSchemaFor(proposition, allConcepts);
  const questionPrompt = questionForProposition(proposition, allConcepts);
  const questionStyleErrors = questionPrompt
    ? validateStylePreservation(
        questionPrompt,
        applyAguriVoice(questionPrompt, emotion),
        wordSurfaces,
        proposition.questionIntent
      )
    : [];
  let pendingQuestion: PendingQuestion | undefined;
  if (questionPrompt && answerSchema.length > 0) {
    pendingQuestion = {
      id: "question_" + crypto.randomUUID(),
      prompt: questionPrompt,
      choices: answerSchema,
      questionIntent: proposition.questionIntent,
      answerSchema,
      proposition,
      ...(proposition.wordIds.length >= 2 && proposition.questionIntent.startsWith("relation_")
        ? {
            relationDraft: {
              fromConceptId: proposition.wordIds[0]!,
              toConceptId: proposition.wordIds[1]!,
              type: "associated_with"
            }
          }
        : {})
    };
  }

  const session: ConversationSession = {
    schemaVersion: 2,
    dialogueRevision: CURRENT_DIALOGUE_REVISION,
    id: "session_" + crypto.randomUUID(),
    phase: "opening",
    intent: candidate.template.intent,
    locationId,
    templateIds: [candidate.template.id],
    slotConceptIds: Object.fromEntries(
      Object.entries(candidate.slots).map(([key, value]) => [key, value.id])
    ),
    topicWordIds: proposition.wordIds,
    proposition,
    ...(narrative.plan ? { narrativePlan: narrative.plan } : {}),
    questionIntent: proposition.questionIntent,
    history: [],
    queuedTurns,
    ...(pendingQuestion ? { pendingQuestion } : {}),
    absurdityCount: proposition.relationType === "drift_hypothesis" ? 1 : 0,
    randomSeed,
    validationErrors: [...queuedTurns.flatMap((turn) => turn.validationErrors), ...questionStyleErrors],
    startedAt: now,
    updatedAt: now
  };
  const structuralErrors = validateConversationSession(session);
  if (structuralErrors.length > 0 || session.validationErrors.length > 0) {
    return safeFallbackSession(focus, candidate, character, locationId, now, randomSeed, [
      ...structuralErrors,
      ...session.validationErrors
    ]);
  }
  return session;
}

function createTurn(input: {
  page: string;
  emotion: DialogueTurn["emotion"];
  proposition: CompositionProposition;
  templateId: string;
  semanticKey: string;
  wordSurfaces: string[];
  now: number;
}): DialogueTurn {
  const styledPreview = applyAguriVoice(input.page, input.emotion);
  const validationErrors = validateStylePreservation(
    input.page,
    styledPreview,
    input.wordSurfaces,
    input.proposition.questionIntent
  );
  return {
    id: "turn_" + crypto.randomUUID(),
    speaker: "aguri",
    page: input.page,
    emotion: input.emotion,
    conceptIds: input.proposition.wordIds,
    requiresAnswer: false,
    answerSchema: [],
    semanticKey: input.semanticKey,
    templateId: input.templateId,
    usedWordIds: input.proposition.wordIds,
    styleBasePage: input.page,
    styledPreview,
    validationErrors,
    createdAt: input.now
  };
}

function safeFallbackSession(
  focus: Concept,
  candidate: ScoredCandidate,
  character: CharacterState,
  locationId: string,
  now: number,
  randomSeed: number,
  validationErrors: string[]
): ConversationSession {
  const proposition: CompositionProposition = {
    wordIds: [focus.id],
    frameId: "safe.single_word",
    relationType: "single_word",
    relationText: "",
    evidence: "none",
    confidence: focus.understanding,
    questionIntent: "none"
  };
  const page = "「" + displayConcept(focus) + "」のことを、いったん一つずつ考え直しますっ。";
  const turn = createTurn({
    page,
    emotion: emotionForIntent(candidate.template.intent, character),
    proposition,
    templateId: "safe_single_word",
    semanticKey: "safe.single_word",
    wordSurfaces: [displayConcept(focus)],
    now
  });
  return {
    schemaVersion: 2,
    dialogueRevision: CURRENT_DIALOGUE_REVISION,
    id: "session_" + crypto.randomUUID(),
    phase: "opening",
    intent: "small_talk",
    locationId,
    templateIds: ["safe_single_word"],
    slotConceptIds: { focus: focus.id },
    topicWordIds: [focus.id],
    proposition,
    questionIntent: "none",
    history: [],
    queuedTurns: [turn],
    absurdityCount: 0,
    randomSeed,
    validationErrors: [...new Set(validationErrors)],
    startedAt: now,
    updatedAt: now
  };
}

function emotionForIntent(intent: ConversationIntent, character: CharacterState) {
  if (intent === "misunderstanding") return "confused" as const;
  if (["invitation", "discovery", "outing_report"].includes(intent)) return "excited" as const;
  if (["recall_memory", "ask_preference"].includes(intent)) return "happy" as const;
  if (intent === "quiet_moment") return character.energy < 35 ? ("sleepy" as const) : ("calm" as const);
  return "curious" as const;
}
