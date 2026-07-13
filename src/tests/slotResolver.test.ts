import { describe, expect, it } from "vitest";
import { dialogueTemplates } from "../data/dialogue-templates/dialogueTemplates";
import { responsePatterns } from "../data/response-patterns/responsePatterns";
import { planConversation } from "../domain/conversation/planner";
import { resolveSlots } from "../domain/conversation/slotResolver";
import { createUserConcept } from "../domain/learning/conceptFactory";
import type { CharacterState } from "../domain/model/character";
import { SeededRandom } from "../infrastructure/random/random";
import type { DialogueTemplate } from "../data/schema/dialogue";
import type { ConceptRelation } from "../domain/model/relation";

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

  it("backtracks to the pair that satisfies the required relation type", () => {
    const unrelatedPerson = createUserConcept(
      { surface: "旅人", category: "person_descriptor" },
      now,
      "unrelated-person"
    );
    const relatedPerson = createUserConcept(
      { surface: "料理人", category: "occupation" },
      now,
      "related-person"
    );
    const food = createUserConcept({ surface: "スープ", category: "food_drink" }, now, "food");
    const template: DialogueTemplate = {
      id: "required_likes_relation",
      semanticFrame: "test.required_relation",
      grounding: "relation_required",
      intent: "observation",
      phase: "premise",
      locations: ["room"],
      moods: ["curious"],
      slots: [
        {
          name: "person",
          categories: ["person_descriptor", "occupation"],
          grammaticalRole: "subject",
          required: true
        },
        {
          name: "food",
          categories: ["food_drink"],
          grammaticalRole: "object",
          required: true
        }
      ],
      constraints: { minUserWords: 2, requiredRelations: ["likes"] },
      variants: ["「{person}」は「{food}」が好きです。"],
      cooldownSessions: 1
    };
    const relation: ConceptRelation = {
      id: "likes_relation",
      fromConceptId: relatedPerson.id,
      toConceptId: food.id,
      type: "likes",
      source: "explicit",
      strength: 0.8,
      confidence: 0.9,
      createdAt: now,
      reinforcedAt: now
    };

    const slots = resolveSlots(
      template,
      [unrelatedPerson, relatedPerson, food],
      [relation],
      [],
      new SeededRandom(3)
    );

    expect(slots).toBeDefined();
    expect(slots!.person!.id).toBe(relatedPerson.id);
    expect(slots!.food!.id).toBe(food.id);
  });

  it("does not satisfy a typed relation constraint with another relation type", () => {
    const person = createUserConcept({ surface: "料理人", category: "occupation" }, now, "wrong-type-person");
    const food = createUserConcept({ surface: "スープ", category: "food_drink" }, now, "wrong-type-food");
    const template: DialogueTemplate = {
      id: "requires_likes_only",
      semanticFrame: "test.requires_likes",
      grounding: "relation_required",
      intent: "observation",
      phase: "premise",
      locations: ["room"],
      moods: ["curious"],
      slots: [
        { name: "person", categories: ["occupation"], grammaticalRole: "subject", required: true },
        { name: "food", categories: ["food_drink"], grammaticalRole: "object", required: true }
      ],
      constraints: { requiredRelations: ["likes"] },
      variants: ["「{person}」は「{food}」が好きです。"],
      cooldownSessions: 1
    };
    const wrongRelation: ConceptRelation = {
      id: "wrong_relation",
      fromConceptId: person.id,
      toConceptId: food.id,
      type: "uses",
      source: "explicit",
      strength: 0.8,
      confidence: 0.9,
      createdAt: now,
      reinforcedAt: now
    };

    expect(resolveSlots(template, [person, food], [wrongRelation], [], new SeededRandom(4))).toBeUndefined();
  });
});
