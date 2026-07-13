import { describe, expect, it } from "vitest";
import { storyArcVariantCount, storyArcVariants } from "../data/story-arcs/storyArcCatalog";
import { createDebugLearnedConcepts } from "../data/debug/createDebugLearnedConcepts";
import { renderStoryArc } from "../domain/conversation/storyArcGenerator";

const focus = createDebugLearnedConcepts(1, 1_700_000_000_000)[0]!;

describe("story arc catalog", () => {
  it("provides exactly 400 unique compositional story plans", () => {
    expect(storyArcVariantCount).toBe(400);
    expect(new Set(storyArcVariants.map((variant) => variant.id)).size).toBe(400);
  });

  it("can deterministically render every story plan with a turn and punchline", () => {
    const rendered = storyArcVariants.map((_, index) =>
      renderStoryArc({
        focus,
        random: { next: () => (index + 0.5) / storyArcVariantCount }
      })
    );

    expect(new Set(rendered.map((arc) => arc.id)).size).toBe(400);
    expect(new Set(rendered.map((arc) => `${arc.turn}\n${arc.punchline}`)).size).toBe(400);
    expect(rendered.every((arc) => arc.turn.length > 0 && arc.punchline.length > 0)).toBe(true);
    expect(rendered.every((arc) => /[。！]$/u.test(arc.turn) && /！$/u.test(arc.punchline))).toBe(true);
    expect(
      rendered.every((arc) => !/undefined|null|\[object Object\]/u.test(`${arc.turn}${arc.punchline}`))
    ).toBe(true);
  });

  it("gives each learned-word category family ten distinct punchlines", () => {
    const representatives = createDebugLearnedConcepts(100, 1_700_000_000_000).filter(
      (concept, index, concepts) => {
        const group = groupFor(concept.userCategory);
        return concepts.findIndex((candidate) => groupFor(candidate.userCategory) === group) === index;
      }
    );

    for (const concept of representatives) {
      const endings = Array.from(
        { length: 10 },
        (_, punchlineIndex) =>
          renderStoryArc({
            focus: concept,
            random: { next: () => (punchlineIndex + 0.5) / storyArcVariantCount }
          }).punchline
      );
      expect(new Set(endings).size).toBe(10);
    }
  });
});

function groupFor(category: string) {
  if (["famous_person", "person_name", "occupation", "person_descriptor", "robot"].includes(category))
    return "person";
  if (category === "food_drink") return "food";
  if (category === "place") return "place";
  if (["action", "required_action", "forbidden_action", "sport", "skill"].includes(category)) return "action";
  if (category === "living_thing") return "living";
  if (
    ["usable_object", "wearable", "vehicle", "music", "viewable", "readable", "body_part"].includes(category)
  )
    return "thing";
  return "idea";
}
