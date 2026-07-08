import { describe, expect, it } from "vitest";
import { createDebugWordSeed, DEBUG_WORD_SEED_COUNT } from "../data/debug/debugWordSeed";
import type { WordFrame } from "../types/domain";

describe("debug word seed", () => {
  it("creates 100 filled WordFrame records", () => {
    const words = createDebugWordSeed();
    const ids = new Set(words.map((word) => word.id));
    const surfaces = new Set(words.map((word) => word.surface));

    expect(DEBUG_WORD_SEED_COUNT).toBe(100);
    expect(words).toHaveLength(100);
    expect(ids.size).toBe(100);
    expect(surfaces.size).toBe(100);

    for (const word of words) {
      expect(word.id).toMatch(/^debug_word_\d{3}$/);
      expect(word.surface).not.toBe("");
      expect(word.reading).not.toBe("");
      expect(word.category).not.toBe("unknown");
      expect(word.semantic_type).not.toBe("");
      expect(word.part_of_speech).not.toBe("unknown");
      expect(word.emotion_tags.length).toBeGreaterThan(0);
      expect(word.situation_tags.length).toBeGreaterThan(0);
      expect(word.relation_tags.length).toBeGreaterThan(0);
      expect(word.affordances.length).toBeGreaterThan(0);
      expect(word.source_question_ids.length).toBeGreaterThan(0);
      expect(word.confidence).toBeGreaterThanOrEqual(0.4);
      expect(word.confidence).toBeLessThanOrEqual(0.95);
      expect(word.taught_by_user).toBe(true);
      expect(word.is_sensitive).toBe(false);
      expect(word.is_blocked).toBe(false);
      expect(word.notes).toContain("debug seed:");
    }
  });

  it("skips words whose surface already exists", () => {
    const existing = [{ surface: "カレー" }, { surface: "公園" }] as WordFrame[];
    const words = createDebugWordSeed(existing);

    expect(words).toHaveLength(98);
    expect(words.some((word) => word.surface === "カレー")).toBe(false);
    expect(words.some((word) => word.surface === "公園")).toBe(false);
  });

  it("keeps related word ids inside the seed set", () => {
    const words = createDebugWordSeed();
    const ids = new Set(words.map((word) => word.id));

    for (const word of words) {
      for (const relatedId of word.related_word_ids) {
        expect(ids.has(relatedId)).toBe(true);
      }
    }
  });
});
