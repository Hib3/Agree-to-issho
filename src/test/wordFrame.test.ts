import { describe, expect, it } from "vitest";
import { applyDetailedReview } from "../game/word/review";
import { applyCategory, applyEmotion, applySituation, createWordFrame } from "../game/word/createWordFrame";
import { migrateWordFrame } from "../game/word/wordMemory";

describe("WordFrame", () => {
  it("creates and enriches a user-taught word frame", () => {
    const draft = createWordFrame("  テスト語  ");
    const categorized = applyCategory(draft, "idea");
    const emotional = applyEmotion(categorized, "curious", "neutral");
    const situated = applySituation(emotional, "daily_talk");

    expect(situated.surface).toBe("テスト語");
    expect(situated.category).toBe("idea");
    expect(situated.emotion_tags).toContain("curious");
    expect(situated.situation_tags).toContain("daily_talk");
    expect(situated.confidence).toBeGreaterThan(0.8);
    expect(situated.memory_strength).toBeGreaterThan(0.4);
    expect(situated.favorite_score).toBeGreaterThan(0.2);
    expect(situated.taught_by_user).toBe(true);
  });

  it("migrates an old word frame with memory defaults", () => {
    const migrated = migrateWordFrame({
      id: "old_word",
      surface: "古い言葉",
      category: "unknown",
      confidence: 0.3,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z"
    });

    expect(migrated.memory_strength).toBe(0.4);
    expect(migrated.favorite_score).toBe(0.2);
    expect(migrated.ambiguity_score).toBe(0.4);
    expect(migrated.drift_level).toBe(1);
    expect(migrated.review_count).toBe(0);
    expect(migrated.correction_count).toBe(0);
  });

  it("applies detailed review fields and strengthens memory", () => {
    const word = createWordFrame("カレー");
    const reviewed = applyDetailedReview(word, {
      category: "food",
      emotion: "happy",
      situation: "daily_talk",
      reading: "かれー",
      notes: "夕飯の話題"
    });

    expect(reviewed.category).toBe("food");
    expect(reviewed.emotion_tags).toEqual(["happy"]);
    expect(reviewed.situation_tags).toEqual(["daily_talk"]);
    expect(reviewed.reading).toBe("かれー");
    expect(reviewed.notes).toBe("夕飯の話題");
    expect(reviewed.review_count).toBe(1);
    expect(reviewed.memory_strength).toBeGreaterThan(word.memory_strength);
  });
});
