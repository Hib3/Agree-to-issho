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
  });

  it("never cuts a Japanese sentence in the middle of a word", () => {
    const sentence = "「消しゴム」の中に「星形クッキー」があったら、開ける前から少しわくわくしますっ。";
    expect(splitJapanesePages(sentence, 20)).toEqual([sentence]);
  });
});
