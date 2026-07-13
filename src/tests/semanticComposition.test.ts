import { describe, expect, it } from "vitest";
import type { CharacterState } from "../domain/model/character";
import type { ConversationSession } from "../domain/model/conversation";
import { createUserConcept } from "../domain/learning/conceptFactory";
import { planConversation } from "../domain/conversation/planner";
import { applyResponse } from "../domain/conversation/responseBranching";
import type { DialogueTemplate } from "../data/schema/dialogue";
import { responsePatterns } from "../data/response-patterns/responsePatterns";
import { SeededRandom } from "../infrastructure/random/random";
import { dialogueTemplates } from "../data/dialogue-templates/dialogueTemplates";
import { starterConcepts } from "../data/starter/starterConcepts";
import { validateAnswerSchema, validateConversationSession, validateStylePreservation } from "../domain/conversation/dialogueValidator";
import { migrateConversationSession } from "../domain/conversation/sessionMigration";
import { applyAguriVoice } from "../domain/voice/aguriVoice";
import type { ConceptRelation } from "../domain/model/relation";
import { answerSchemaFor } from "../domain/conversation/semanticComposition";

const now = 1_700_000_000_000;
const character: CharacterState = {
  id: "aguri",
  name: "アグリちゃん",
  emotion: "curious",
  energy: 80,
  closeness: 20,
  curiosity: 0.8,
  socialNeed: 20,
  trust: 20,
  boredom: 0,
  currentLocationId: "room",
  lastUserInteractionAt: now,
  lastSpeechAt: now,
  updatedAt: now
};

const unrelatedPairTemplate: DialogueTemplate = {
  id: "test_unrelated_person_food",
  semanticFrame: "test.person_food",
  grounding: "relation_required",
  intent: "ask_relation",
  phase: "premise",
  locations: ["room"],
  moods: ["curious"],
  slots: [
    { name: "person", categories: ["person_descriptor"], grammaticalRole: "subject", required: true },
    { name: "food", categories: ["food_drink"], grammaticalRole: "object", required: true }
  ],
  constraints: { minUserWords: 2 },
  variants: ["「{person}」のそばに「{food}」がある場面を考えました。"],
  responsePatternIds: ["response_1"],
  cooldownSessions: 1
};

function planUnrelatedPair() {
  const adult = {
    ...createUserConcept({ surface: "おとな", category: "person_descriptor" }, now, "adult"),
    understanding: 0.42,
    ambiguity: 0.66
  };
  const bonito = {
    ...createUserConcept({ surface: "かつお節", category: "food_drink" }, now, "bonito"),
    understanding: 0.48,
    ambiguity: 0.61
  };
  return {
    concepts: [adult, bonito],
    session: planConversation({
      templates: [unrelatedPairTemplate],
      responsePatterns,
      concepts: [adult, bonito],
      relations: [],
      recentSessions: [],
      character,
      locationId: "room",
      now,
      random: new SeededRandom(1)
    })
  };
}

describe("semantic composition regression", () => {
  it("does not invent a scene for the unrelated words おとな and かつお節", () => {
    const { session } = planUnrelatedPair();
    const transcript = session.queuedTurns.map((turn) => turn.page).join("\n");

    expect(transcript).not.toContain("そばに");
    expect(transcript).not.toContain("こんなふう");
    expect(session.pendingQuestion?.prompt).toContain("おとな");
    expect(session.pendingQuestion?.prompt).toContain("かつお節");
    expect(session.pendingQuestion?.prompt).toContain("関係");
  });

  it("offers only semantic relation answers for relation discovery", () => {
    const { session } = planUnrelatedPair();
    const choices = session.pendingQuestion?.choices ?? [];
    const relationChoices = choices.filter((choice) => choice.effect === "affirm");

    expect(relationChoices.length).toBeGreaterThan(0);
    expect(relationChoices.every((choice) => choice.answerEffect?.relationType && choice.answerEffect.memoryEffect === "link_words")).toBe(true);
    expect(choices.at(-2)?.effect).toBe("deny");
    expect(choices.at(-1)?.effect).toBe("curious");
    expect(choices.map((choice) => choice.label)).not.toContain("続きを聞きたい");
    expect(choices.map((choice) => choice.label)).not.toContain("あとで考える");
  });

  it("does not mutate word memory for a navigation-only answer", () => {
    const { concepts, session } = planUnrelatedPair();
    const navigationSession: ConversationSession = {
      ...session,
      phase: "awaiting_answer"
    };
    const result = applyResponse(
      navigationSession,
      { id: "close", label: "今日はここまで", effect: "later" },
      character,
      [],
      concepts,
      now + 1
    );

    expect(result.relations).toEqual([]);
    expect(result.concepts).toEqual(concepts);
    expect(result.effect.flags).toContain("topic_later");
  });

  it("uses an explicit confirmed relation instead of inventing a scene", () => {
    const { concepts } = planUnrelatedPair();
    const relation: ConceptRelation = {
      id: "relation_confirmed",
      fromConceptId: concepts[0]!.id,
      toConceptId: concepts[1]!.id,
      type: "associated_with",
      source: "explicit",
      strength: 0.8,
      confidence: 0.9,
      createdAt: now,
      reinforcedAt: now
    };
    const session = planConversation({
      templates: [unrelatedPairTemplate],
      responsePatterns,
      concepts,
      relations: [relation],
      recentSessions: [],
      character,
      locationId: "room",
      now,
      random: new SeededRandom(2),
      randomSeed: 2
    });
    const transcript = session.queuedTurns.map((turn) => turn.page).join("\n");

    expect(session.proposition.relationType).toBe("confirmed_relation");
    expect(session.proposition.evidence).toBe("confirmed_relation");
    expect(session.proposition.relationText).toContain("関係がある");
    expect(session.questionIntent).toBe("relation_confirmation");
    expect(transcript).not.toContain("そばに");
  });

  it("does not create a relation when relation discovery is rejected", () => {
    const { concepts, session } = planUnrelatedPair();
    const reject = session.pendingQuestion?.answerSchema.find((choice) => choice.answerEffect?.semanticEffect === "reject");
    expect(reject).toBeDefined();
    const result = applyResponse({ ...session, phase: "awaiting_answer" }, reject!, character, [], concepts, now + 1);

    expect(result.relations).toEqual([]);
    expect(result.answer.memoryEffect).toBe("none");
  });

  it("stores the relation type selected by the player", () => {
    const { concepts, session } = planUnrelatedPair();
    const eats = session.pendingQuestion?.answerSchema.find((choice) => choice.answerEffect?.relationType === "eats_drinks");
    expect(eats).toBeDefined();
    const result = applyResponse({ ...session, phase: "awaiting_answer" }, eats!, character, [], concepts, now + 1);

    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]).toMatchObject({
      fromConceptId: concepts[0]!.id,
      toConceptId: concepts[1]!.id,
      type: "eats_drinks",
      source: "answer"
    });
    expect(result.session.queuedTurns.at(-1)?.page).toContain("食べたり飲んだりする");
  });

  it("updates and names only the asked word in a preference answer", () => {
    const { concepts, session } = planUnrelatedPair();
    const preferenceProposition = {
      ...session.proposition,
      relationType: "scene_hypothesis" as const,
      evidence: "scene_frame" as const,
      relationText: "「おとな」が「かつお節」を見る場面",
      questionIntent: "preference_question" as const
    };
    const preferenceSession: ConversationSession = {
      ...session,
      phase: "awaiting_answer",
      proposition: preferenceProposition,
      questionIntent: "preference_question",
      topicWordIds: preferenceProposition.wordIds
    };
    const neutral = answerSchemaFor(preferenceProposition).find((item) => item.id === "preference_neutral")!;
    const result = applyResponse(preferenceSession, neutral, character, [], concepts, now + 1);
    const reaction = result.session.queuedTurns.at(-1)?.page ?? "";

    expect(result.concepts.find((item) => item.id === concepts[0]!.id)?.preference).toBe(0);
    expect(result.concepts.find((item) => item.id === concepts[1]!.id)?.preference).toBe(concepts[1]!.preference);
    expect(reaction).toContain("おとな");
    expect(reaction).not.toContain("かつお節");
    expect(result.effect.flags).toContain("preference_learned");
    expect(result.effect.flags).not.toContain("topic_later");
  });

  it("invalidates a legacy session without replaying its queued question", () => {
    const legacy = {
      schemaVersion: 2,
      dialogueRevision: 2,
      id: "legacy_broken",
      phase: "awaiting_answer",
      intent: "ask_relation",
      locationId: "room",
      templateIds: ["legacy"],
      slotConceptIds: { first: "adult", second: "bonito" },
      history: [],
      queuedTurns: [{ id: "old", speaker: "aguri", page: "このつながりですか？", emotion: "curious", conceptIds: ["adult", "bonito"], createdAt: now }],
      pendingQuestion: { id: "old_question", prompt: "このつながりですか？", choices: [] },
      absurdityCount: 0,
      startedAt: now,
      updatedAt: now
    } as unknown as ConversationSession;
    const migrated = migrateConversationSession(legacy, now + 1);

    expect(migrated.phase).toBe("completed");
    expect(migrated.dialogueRevision).toBe(3);
    expect(migrated.queuedTurns).toEqual([]);
    expect(migrated.pendingQuestion).toBeUndefined();
    expect(migrated.validationErrors).toContain("legacy_session_invalidated");
  });

  it("keeps words, negation and the question target through Aguri's style layer", () => {
    const base = "「おとな」と「かつお節」には関係がないですか？";
    const styled = applyAguriVoice(base, "curious");
    expect(validateStylePreservation(base, styled, ["おとな", "かつお節"], "relation_confirmation")).toEqual([]);
    expect(styled).toContain("関係がない");
    expect(styled).toMatch(/[？?]/u);
  });

  it("only combines conversation intents with compatible semantic frames", () => {
    const comparisons = dialogueTemplates.filter((template) => template.intent === "comparison");
    const preferences = dialogueTemplates.filter((template) => template.intent === "ask_preference");
    const meaningChecks = dialogueTemplates.filter((template) => template.intent === "ask_meaning");
    const relationChecks = dialogueTemplates.filter((template) => template.intent === "ask_relation");

    expect(comparisons.map((template) => template.semanticFrame)).toEqual([
      "comparison.wearable_person_comparison",
      "comparison.idea_comparison"
    ]);
    expect(preferences.every((template) => template.slots.length === 1)).toBe(true);
    expect(meaningChecks.every((template) => template.slots.length === 1)).toBe(true);
    expect(relationChecks.every((template) => template.grounding === "relation_required" && template.slots.length === 2)).toBe(true);
  });

  it("realizes a typed person-place-action scene with explicit grammatical roles", () => {
    const sceneTemplate = dialogueTemplates.find((template) => template.id === "dialogue_daydream_person_action_place")!;
    const concepts = [
      createUserConcept({ surface: "運転手", category: "occupation" }, now, "driver"),
      createUserConcept({ surface: "水やり", category: "action" }, now, "watering"),
      createUserConcept({ surface: "庭", category: "place" }, now, "garden")
    ];
    const session = planConversation({
      templates: [sceneTemplate],
      responsePatterns,
      concepts,
      relations: [],
      recentSessions: [],
      character,
      locationId: "room",
      now,
      random: new SeededRandom(4),
      randomSeed: 4
    });
    const transcript = session.queuedTurns.map((turn) => turn.page).join("\n");

    expect(transcript).toContain("「運転手」が「庭」で「水やり」を続けている");
    expect(transcript).not.toContain("二つを比べてみたら");
    expect(session.proposition.relationType).toBe("scene_hypothesis");
    expect(session.proposition.evidence).toBe("category_only");
    expect(session.pendingQuestion?.prompt).toContain("「運転手」・「水やり」・「庭」");
    expect(session.pendingQuestion?.questionIntent).toBe("situation_question");
  });

  it("marks a deliberate category-based mismatch as one correctable hypothesis", () => {
    const mismatchTemplate = dialogueTemplates.find((template) => template.id === "dialogue_misunderstanding_person_action_place")!;
    const concepts = [
      createUserConcept({ surface: "運転手", category: "occupation" }, now, "driver-mismatch"),
      createUserConcept({ surface: "水やり", category: "action" }, now, "watering-mismatch"),
      createUserConcept({ surface: "庭", category: "place" }, now, "garden-mismatch")
    ];
    const session = planConversation({
      templates: [mismatchTemplate],
      responsePatterns,
      concepts,
      relations: [],
      recentSessions: [],
      character,
      locationId: "room",
      now,
      random: new SeededRandom(5),
      randomSeed: 5
    });

    expect(session.proposition.relationType).toBe("drift_hypothesis");
    expect(session.proposition.evidence).toBe("category_only");
    expect(session.absurdityCount).toBe(1);
    expect(session.pendingQuestion?.questionIntent).toBe("correction_request");
    expect(session.pendingQuestion?.prompt).toContain("運転手");
    expect(session.pendingQuestion?.prompt).toContain("水やり");
    expect(session.pendingQuestion?.prompt).toContain("庭");
  });

  it("rejects an awaiting session whose question record is missing", () => {
    const { session } = planUnrelatedPair();
    const broken: ConversationSession = {
      ...session,
      phase: "awaiting_answer"
    };
    delete broken.pendingQuestion;

    expect(validateConversationSession(broken)).toContain("missing_pending_question");
  });

  it("rejects preference answers attached to a relation question", () => {
    const preferenceChoice = {
      id: "wrong_preference",
      label: "好き",
      effect: "affirm" as const,
      answerEffect: {
        semanticEffect: "preference_like" as const,
        navigationEffect: "none" as const,
        memoryEffect: "update_preference" as const
      }
    };

    expect(validateAnswerSchema("relation_discovery", [preferenceChoice])).toContain("answer_intent_mismatch");
    expect(validateAnswerSchema("relation_discovery", [preferenceChoice])).toContain("memory_intent_mismatch");
  });

  it("generates 1000 deterministic sessions without ungrounded or mismatched dialogue", () => {
    const learned = createUserConcept({ surface: "星形クッキー", category: "food_drink", preference: 2 }, now, "mass");
    const concepts = [...starterConcepts, learned];
    const templates = dialogueTemplates.filter((template) => template.locations.includes("room")).slice(0, 64);
    const failures: string[] = [];

    for (let seed = 1; seed <= 1000; seed += 1) {
      const session = planConversation({
        templates,
        responsePatterns,
        concepts,
        relations: [],
        recentSessions: [],
        character,
        locationId: "room",
        now: now + seed,
        random: new SeededRandom(seed),
        randomSeed: seed
      });
      const transcript = session.queuedTurns.map((turn) => turn.page).join("\n");
      const errors = validateConversationSession(session);
      if (errors.length > 0) failures.push(seed + ":validation:" + errors.join(","));
      if (session.validationErrors.length > 0) failures.push(seed + ":fallback:" + session.validationErrors.join(","));
      if (/こんなふうに|このつながり|この組み合わせ|変じゃない/u.test(transcript)) {
        failures.push(seed + ":bare_reference");
      }
      if (session.pendingQuestion) {
        const answerErrors = validateConversationSession({ ...session, phase: "awaiting_answer", queuedTurns: [] });
        if (answerErrors.length > 0) failures.push(seed + ":answer:" + answerErrors.join(","));
      }
    }

    expect(failures).toEqual([]);
  });
});
