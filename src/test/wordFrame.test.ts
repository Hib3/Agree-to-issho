import { describe, expect, it } from "vitest";
import { applyCategory, applyEmotion, applySituation, createWordFrame } from "../game/word/createWordFrame";

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
    expect(situated.taught_by_user).toBe(true);
  });
});
