import { describe, expect, it } from "vitest";
import { starterConcepts } from "../data/starter/starterConcepts";
import { createUserConcept } from "../domain/learning/conceptFactory";
import { displayConcept, doPhrase, doingPhrase } from "../domain/grammar/japaneseRealizer";

const corpus = starterConcepts.slice(0, 160);

describe("Japanese lexical corpus", () => {
  it("covers exactly 160 original everyday concepts", () => {
    expect(corpus).toHaveLength(160);
    expect(new Set(corpus.map((concept) => concept.surface)).size).toBe(160);
  });

  it("realizes every corpus entry without runtime leaks or doubled particles", () => {
    for (const concept of corpus) {
      const text = `${displayConcept(concept)} / ${doPhrase(concept)} / ${doingPhrase(concept)}`;
      expect(text).not.toMatch(/undefined|null|NaN|\[object Object\]/u);
      expect(text).not.toMatch(/(はは|がが|をを|にに|でで|とと)/u);
      expect(text).not.toMatch(/\{[^}]+\}/u);
    }
  });

  it("uses mention-only fallback for an unknown action word", () => {
    const concept = createUserConcept(
      {
        surface: "ぴかるん",
        category: "action",
        lexicalProfile: {
          partOfSpeech: "unknown",
          quotePolicy: "mention_only",
          honorificPolicy: "none",
          confidence: 0
        }
      },
      1_700_000_000_000,
      "unknown-action"
    );

    expect(doPhrase(concept)).toBe("「ぴかるん」を始める");
    expect(doingPhrase(concept)).toBe("「ぴかるん」を続けている");
  });

  it("does not append a second honorific", () => {
    const concept = createUserConcept(
      {
        surface: "田中さん",
        category: "person_name",
        attributes: { honorific: "san" }
      },
      1_700_000_000_000,
      "honorific"
    );
    expect(displayConcept(concept)).toBe("田中さん");
  });
});
