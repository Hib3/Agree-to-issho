import { describe, expect, it } from "vitest";
import { dialogueTemplates } from "../data/dialogue-templates/dialogueTemplates";
import { responsePatterns } from "../data/response-patterns/responsePatterns";
import { planConversation } from "../domain/conversation/planner";
import { resolveSlots } from "../domain/conversation/slotResolver";
import { createUserConcept } from "../domain/learning/conceptFactory";
import type { CharacterState } from "../domain/model/character";
import { SeededRandom } from "../infrastructure/random/random";

const now = 1_700_000_000_000;
const character: CharacterState = {
  id: "aguri",
  name: "アグリちゃん",
  emotion: "curious",
  energy: 80,
  closeness: 30,
  curiosity: 0.8,
  socialNeed: 20,
  trust: 30,
  boredom: 10,
  currentLocationId: "room",
  lastUserInteractionAt: now,
  lastSpeechAt: now,
  updatedAt: now
};

describe("slot resolution recency fallback", () => {
  it("keeps the only compatible learned word available after recent use", () => {
    const word = createUserConcept({ surface: "星形クッキー", category: "food_drink" }, now, "star-cookie");
    const template = dialogueTemplates.find((item) => item.id === "dialogue_small_talk_single_topic");
    expect(template).toBeDefined();
    const first = planConversation({
      templates: [template!],
      responsePatterns,
      concepts: [word],
      relations: [],
      recentSessions: [],
      character,
      locationId: "room",
      now,
      random: new SeededRandom(1),
      randomSeed: 1
    });
    const slots = resolveSlots(
      template!,
      [word],
      [],
      [{ ...first, phase: "completed", completedAt: now + 1 }],
      new SeededRandom(2)
    );
    expect(slots?.word?.id).toBe(word.id);
  });
});
