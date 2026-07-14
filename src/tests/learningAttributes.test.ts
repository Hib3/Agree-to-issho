import { describe, expect, it } from "vitest";
import { dialogueTemplates } from "../data/dialogue-templates/dialogueTemplates";
import { responsePatterns } from "../data/response-patterns/responsePatterns";
import { attributeMemoryBeat } from "../domain/conversation/attributeNarration";
import { planConversation } from "../domain/conversation/planner";
import { applyResponse } from "../domain/conversation/responseBranching";
import { attributeQuestionsForCategory } from "../domain/learning/attributeQuestions";
import { createUserConcept } from "../domain/learning/conceptFactory";
import { createLearningSession, transitionLearning } from "../domain/learning/learningMachine";
import type { CharacterState } from "../domain/model/character";
import { starterConcepts } from "../data/starter/starterConcepts";
import { createDebugLearnedConcepts } from "../data/debug/createDebugLearnedConcepts";
import { SeededRandom } from "../infrastructure/random/random";

const now = 1_700_000_000_000;
const character: CharacterState = {
  id: "aguri",
  name: "アグリちゃん",
  emotion: "curious",
  energy: 76,
  closeness: 36,
  curiosity: 0.84,
  socialNeed: 24,
  trust: 40,
  boredom: 22,
  currentLocationId: "room",
  lastUserInteractionAt: now,
  lastSpeechAt: now,
  updatedAt: now
};

describe("typed learning attributes", () => {
  it("keeps debug action attributes consistent with known inflection", () => {
    const letter = createDebugLearnedConcepts(100, now).find((concept) => concept.surface === "手紙");
    expect(letter).toBeDefined();
    expect(letter?.grammar.verbDictionaryForm).toBe("手紙を書く");
    expect(letter?.grammar.suruAction).toBe(false);
    expect(letter?.attributes.suruAction).toBe(false);
    expect(attributeMemoryBeat(letter!)).not.toContain("ですること");
    expect(attributeMemoryBeat(letter!)).toContain("取り組める");
  });

  it("keeps land snails out of the aquatic habitat memory", () => {
    const snail = createDebugLearnedConcepts(100, now).find((concept) => concept.surface === "かたつむり");
    expect(snail?.attributes.habitat).toBe("land");
    expect(attributeMemoryBeat(snail!)).toContain("地面や野原");
    expect(attributeMemoryBeat(snail!)).not.toContain("水の中や水辺");
  });

  it("varies attribute recall wording without changing the learned meaning", () => {
    const letter = createDebugLearnedConcepts(100, now).find((concept) => concept.surface === "手紙")!;
    const variants = [0, 1, 2].map((usageCount) => attributeMemoryBeat({ ...letter, usageCount }));
    expect(new Set(variants).size).toBe(3);
    expect(variants.every((text) => text.includes("家や屋内") && text.includes("取り組める"))).toBe(true);
  });

  it("defines multiple category-specific questions", () => {
    expect(attributeQuestionsForCategory("person_name").map((item) => item.id)).toEqual([
      "honorific",
      "personKind",
      "relativeStatus",
      "familiarity"
    ]);
    expect(attributeQuestionsForCategory("usable_object").map((item) => item.id)).toEqual([
      "objectKind",
      "usageMode",
      "affordance",
      "importanceWhenMissing"
    ]);
  });

  it("persists every answer position before preference and confirmation", () => {
    let session = createLearningSession("daily_object", now, "street");
    session = transitionLearning(session, { type: "ENTER_TEXT", value: "記録ペン" }, now + 1);
    session = transitionLearning(session, { type: "NORMALIZED" }, now + 2);
    session = transitionLearning(session, { type: "NO_DUPLICATE" }, now + 3);
    session = transitionLearning(session, { type: "SELECT_CATEGORY", category: "usable_object" }, now + 4);

    const answers = [
      ["objectKind", "tool"],
      ["usageMode", "use"],
      ["affordance", "record"],
      ["importanceWhenMissing", "troublesome"]
    ] as const;
    answers.forEach(([key, value], index) => {
      session = transitionLearning(
        session,
        {
          type: "ANSWER_ATTRIBUTE",
          key,
          value,
          isLast: index === answers.length - 1
        },
        now + 5 + index
      );
      expect(session.attributes[key]).toBe(value);
      expect(session.state).toBe(
        index === answers.length - 1 ? "preference_question" : "category_attributes"
      );
    });

    session = transitionLearning(session, { type: "SET_PREFERENCE", preference: 2 }, now + 10);
    session = transitionLearning(session, { type: "SET_READING", reading: "きろくぺん" }, now + 11);
    expect(session.state).toBe("confirmation");
    expect(session.reading).toBe("きろくぺん");
    expect(session.attributeQuestionIndex).toBe(3);
    expect(session.locationId).toBe("street");
  });

  it("uses learned object attributes inside a multi-page daily story", () => {
    const concept = createUserConcept(
      {
        surface: "記録ペン",
        category: "usable_object",
        preference: 2,
        attributes: {
          objectKind: "tool",
          usageMode: "use",
          affordance: "record",
          importanceWhenMissing: "essential"
        }
      },
      now,
      "typed-object"
    );
    const beat = attributeMemoryBeat(concept);
    expect(beat).toContain("手で使う");
    expect(beat).toContain("記録");

    const template = dialogueTemplates.find((item) => item.id === "dialogue_small_talk_object_missing_plan");
    expect(template).toBeDefined();
    const session = planConversation({
      templates: [template!],
      responsePatterns,
      concepts: [concept],
      relations: [],
      recentSessions: [],
      character,
      locationId: template!.locations[0] ?? "room",
      now,
      random: new SeededRandom(17),
      randomSeed: 17
    });
    const transcript = session.queuedTurns.map((turn) => turn.page).join("\n");
    expect(session.queuedTurns.length).toBeGreaterThanOrEqual(3);
    expect(transcript).toContain("記録ペン");
    expect(transcript).toContain("手で使う");
    expect(transcript).toContain("見つから");
  });

  it("does not claim that built-in life words were taught by the player", () => {
    const starter = starterConcepts.find((concept) => Object.keys(concept.attributes).length > 0);
    expect(starter).toBeDefined();
    expect(attributeMemoryBeat(starter!)).not.toContain("教わ");
  });

  it("asks about a stored attribute and clears only the rejected claim", () => {
    const concept = createUserConcept(
      {
        surface: "記録ペン",
        category: "usable_object",
        preference: 1,
        attributes: {
          objectKind: "tool",
          usageMode: "use",
          affordance: "record",
          importanceWhenMissing: "troublesome"
        }
      },
      now,
      "attribute-review"
    );
    const template = dialogueTemplates.find((item) => item.id === "dialogue_ask_meaning_object_missing_plan");
    expect(template).toBeDefined();
    const session = planConversation({
      templates: [template!],
      responsePatterns,
      concepts: [concept],
      relations: [],
      recentSessions: [],
      character,
      locationId: template!.locations[0] ?? "room",
      now,
      random: new SeededRandom(29),
      randomSeed: 29
    });
    expect(session.questionIntent).toBe("attribute_confirmation");
    expect(session.proposition.attributeClaim?.key).toBe("objectKind");
    expect(session.pendingQuestion?.prompt).toContain("どんな種類の物");
    const reject = session.pendingQuestion?.choices.find((choice) => choice.id === "attribute_no");
    expect(reject).toBeDefined();
    const result = applyResponse(
      { ...session, phase: "awaiting_answer" },
      reject!,
      character,
      [],
      [concept],
      now + 1
    );
    const updated = result.concepts[0]!;
    expect(updated.attributes.objectKind).toBe("unknown");
    expect(updated.attributes.usageMode).toBe("use");
    expect(updated.ambiguity).toBeGreaterThan(concept.ambiguity);
  });
});
