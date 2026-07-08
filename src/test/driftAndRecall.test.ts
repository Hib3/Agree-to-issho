import { describe, expect, it } from "vitest";
import { dialogueTemplates } from "../data/templates/dialogueTemplates";
import { chooseDriftMode, applyCorrectionToWord } from "../game/dialogue/drift";
import { selectWordForTemplate } from "../game/dialogue/wordScoring";
import { applyCategory, createWordFrame } from "../game/word/createWordFrame";

describe("drift and recall safety", () => {
  it("excludes blocked, sensitive, and forgotten words from recall", () => {
    const template = dialogueTemplates.find((item) => item.speech_act === "recall_word")!;
    const blocked = { ...applyCategory(createWordFrame("秘密"), "idea"), confidence: 1, is_blocked: true };
    const sensitive = { ...applyCategory(createWordFrame("慎重語"), "idea"), confidence: 1, is_sensitive: true };
    const forgotten = { ...applyCategory(createWordFrame("外した語"), "idea"), confidence: 1, forgotten_at: "2026-07-08T00:00:00.000Z" };
    const usable = { ...applyCategory(createWordFrame("使える語"), "idea"), confidence: 0.7 };

    expect(selectWordForTemplate([blocked, sensitive, forgotten, usable], template)?.surface).toBe("使える語");
  });

  it("does not drift blocked, sensitive, forgotten, or drift_level zero words", () => {
    const base = { ...applyCategory(createWordFrame("カレー"), "food"), confidence: 0.35, ambiguity_score: 0.9, drift_level: 3 as const };
    const context = { profile: null, character_state: null, settings: null, words: [base], now: "2026-07-08T00:00:00.000Z" };

    expect(chooseDriftMode({ ...base, is_blocked: true }, context)).toBe("correct_use");
    expect(chooseDriftMode({ ...base, is_sensitive: true }, context)).toBe("correct_use");
    expect(chooseDriftMode({ ...base, forgotten_at: "2026-07-08T00:00:00.000Z" }, context)).toBe("correct_use");
    expect(chooseDriftMode({ ...base, drift_level: 0 }, context)).toBe("correct_use");
  });

  it("correction feedback raises confidence and lowers ambiguity", () => {
    const word = { ...applyCategory(createWordFrame("カレー"), "food"), confidence: 0.4, ambiguity_score: 0.8 };
    const corrected = applyCorrectionToWord(word);

    expect(corrected.correction_count).toBe(word.correction_count + 1);
    expect(corrected.confidence).toBeGreaterThan(word.confidence);
    expect(corrected.ambiguity_score).toBeLessThan(word.ambiguity_score);
  });
});
