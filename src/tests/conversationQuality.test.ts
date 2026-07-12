import { describe, expect, it } from "vitest";
import { dialogueTemplates } from "../data/dialogue-templates/dialogueTemplates";
import { responsePatterns } from "../data/response-patterns/responsePatterns";
import { starterConcepts } from "../data/starter/starterConcepts";
import { planConversation } from "../domain/conversation/planner";
import { applyResponse } from "../domain/conversation/responseBranching";
import { createUserConcept } from "../domain/learning/conceptFactory";
import type { CharacterState } from "../domain/model/character";
import { SeededRandom } from "../infrastructure/random/random";
import { splitJapanesePages } from "../domain/grammar/japaneseRealizer";
import { buildIntentBias } from "../domain/conversation/intentPolicy";
import { locations } from "../data/locations/locations";
import { advanceConversation, answerConversation } from "../features/conversation/conversationService";
import { db } from "../infrastructure/db/database";
import type { ConversationSession, DialogueTurn } from "../domain/model/conversation";

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

describe("clean-room conversation composition", () => {
  it("uses a learned word in a multi-page, fully resolved conversation", () => {
    const learned = createUserConcept({ surface: "星形クッキー", category: "food_drink", preference: 2 }, now, "learned");
    const session = planConversation({
      templates: dialogueTemplates,
      responsePatterns,
      concepts: [...starterConcepts, learned],
      relations: [],
      recentSessions: [],
      character,
      locationId: "room",
      now,
      random: new SeededRandom(42)
    });

    expect(session.queuedTurns.length).toBeGreaterThanOrEqual(2);
    const transcript = session.queuedTurns.map((turn) => turn.page).join("\n");
    expect(transcript).toContain("星形クッキー");
    expect(transcript).not.toMatch(/\{[^}]+\}/u);
    expect(transcript).not.toContain("一か所だけ、怪しい気");
    expect(transcript).not.toContain("うまく言葉を選べませんでした");
    if (session.pendingQuestion) {
      expect(session.pendingQuestion.choices.some((choice) => choice.effect === "affirm")).toBe(true);
      expect(session.pendingQuestion.choices.some((choice) => choice.effect === "deny")).toBe(true);
    }
  });

  it("names the actual concepts when learning from a reply", () => {
    const session = planConversation({
      templates: dialogueTemplates,
      responsePatterns,
      concepts: starterConcepts,
      relations: [],
      recentSessions: [],
      character,
      locationId: "room",
      now,
      random: new SeededRandom(7)
    });
    const ids = Object.values(session.slotConceptIds);
    const choice = { id: "yes", label: "合ってる", effect: "affirm" as const };
    const result = applyResponse(session, choice, character, [], starterConcepts, now + 1);
    const reaction = result.session.queuedTurns.at(-1)?.page ?? "";
    const surfaces = ids.map((id) => starterConcepts.find((concept) => concept.id === id)?.surface).filter(Boolean);

    expect(surfaces.some((surface) => reaction.includes(surface!))).toBe(true);
    expect(reaction).not.toContain("そのつながり");
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]?.source).toBe("answer");
    const reviewed = result.concepts.find((concept) => concept.id === ids[0]);
    const before = starterConcepts.find((concept) => concept.id === ids[0]);
    expect(reviewed?.reviewCount).toBe((before?.reviewCount ?? 0) + 1);
  });

  it("prioritizes meaning checks for an uncertain learned word", () => {
    const learned = { ...createUserConcept({ surface: "星形クッキー", category: "food_drink" }, now, "uncertain"), understanding: 0.25, ambiguity: 0.82 };
    const bias = buildIntentBias({ concepts: [...starterConcepts, learned], recentSessions: [], character, location: locations[0]!, now });
    expect(bias.ask_meaning).toBeGreaterThan(bias.small_talk ?? 0);
    expect(bias.misunderstanding).toBeGreaterThan(0);
  });

  it("never cuts a Japanese sentence in the middle of a word", () => {
    const sentence = "「消しゴム」の中に「星形クッキー」があったら、開ける前から少しわくわくしますっ。";
    expect(splitJapanesePages(sentence, 20)).toEqual([sentence]);
  });

  it("shows the final spoken page before opening its answer choices", async () => {
    await db.open();
    await db.transaction("rw", db.tables, async () => {
      for (const table of db.tables) await table.clear();
    });
    const turn: DialogueTurn = {
      id: "turn_last",
      speaker: "aguri",
      page: "質問の前に見せる最後のページですっ！",
      emotion: "curious",
      conceptIds: [],
      createdAt: now
    };
    const session: ConversationSession = {
      id: "session_phase_order",
      phase: "premise",
      intent: "ask_relation",
      locationId: "room",
      templateIds: ["test"],
      slotConceptIds: {},
      history: [],
      queuedTurns: [turn],
      pendingQuestion: {
        id: "question_test",
        prompt: "この質問に答えますかっ？",
        choices: [{ id: "yes", label: "はい", effect: "affirm" }]
      },
      absurdityCount: 0,
      startedAt: now,
      updatedAt: now
    };
    await db.character.put(character);
    await db.conversationSessions.put(session);

    const spoken = await advanceConversation(session.id, now + 1);
    expect(spoken.phase).toBe("closing");
    expect(spoken.history.at(-1)?.page).toBe(turn.page);

    const asking = await advanceConversation(session.id, now + 2);
    expect(asking.phase).toBe("awaiting_answer");
  });

  it("shows Aguri's correction reaction immediately after a deny answer", async () => {
    await db.open();
    await db.transaction("rw", db.tables, async () => {
      for (const table of db.tables) await table.clear();
    });
    const learned = createUserConcept({ surface: "星形クッキー", category: "food_drink" }, now, "answer-flow");
    const session: ConversationSession = {
      id: "session_answer_reaction",
      phase: "awaiting_answer",
      intent: "ask_relation",
      locationId: "room",
      templateIds: ["test"],
      slotConceptIds: { subject: learned.id },
      history: [],
      queuedTurns: [],
      pendingQuestion: {
        id: "question_test",
        prompt: "このつながりですかっ？",
        choices: [{ id: "no", label: "違う", effect: "deny" }]
      },
      absurdityCount: 0,
      startedAt: now,
      updatedAt: now
    };
    await db.character.put(character);
    await db.concepts.put(learned);
    await db.conversationSessions.put(session);

    const reacted = await answerConversation(session.id, { id: "no", label: "違う", effect: "deny" }, now + 1);
    expect(reacted.phase).toBe("closing");
    expect(reacted.history.at(-1)?.page).toContain("違うんですね");
    expect(reacted.pendingQuestion).toBeUndefined();
  });
});
