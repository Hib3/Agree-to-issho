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

  it.each([
    ["手紙", "手紙を書く", "手紙を書いている"],
    ["写真", "写真を撮る", "写真を撮っている"],
    ["水やり", "水をやる", "水をやっている"],
    ["日記", "日記を書く", "日記を書いている"],
    ["走ること", "走る", "走っている"]
  ])("uses the known Japanese collocation for %s", (surface, expectedDo, expectedDoing) => {
    const starter = starterConcepts.find((concept) => concept.surface === surface);
    expect(starter).toBeDefined();
    expect(doPhrase(starter!)).toBe(expectedDo);
    expect(doingPhrase(starter!)).toBe(expectedDoing);

    const learned = createUserConcept({ surface, category: "action" }, 1_700_000_000_000, surface);
    expect(doPhrase(learned)).toBe(expectedDo);
    expect(doingPhrase(learned)).toBe(expectedDoing);
  });

  it("uses an unquoted verbal phrase for an unknown suru noun", () => {
    const concept = createUserConcept(
      { surface: "整理", category: "action" },
      1_700_000_000_000,
      "unknown-suru-noun"
    );
    expect(doPhrase(concept)).toBe("整理をする");
    expect(doingPhrase(concept)).toBe("整理をしている");
  });

  it("prioritizes the user's explicit suru answer over the known lexicon", () => {
    const forcedSuru = createUserConcept(
      { surface: "手紙", category: "action", attributes: { suruAction: true } },
      1_700_000_000_000,
      "forced-suru"
    );
    const rejectedSuru = createUserConcept(
      { surface: "整理", category: "action", attributes: { suruAction: false } },
      1_700_000_000_000,
      "rejected-suru"
    );
    const knownNonSuru = createUserConcept(
      { surface: "手紙", category: "action", attributes: { suruAction: false } },
      1_700_000_000_000,
      "known-non-suru"
    );

    expect(doPhrase(forcedSuru)).toBe("手紙する");
    expect(doPhrase(rejectedSuru)).toBe("「整理」を始める");
    expect(doPhrase(knownNonSuru)).toBe("手紙を書く");
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
