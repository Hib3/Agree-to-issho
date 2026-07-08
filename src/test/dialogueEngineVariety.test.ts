import { describe, expect, it } from "vitest";
import { createDebugWordSeed } from "../data/debug/debugWordSeed";
import { TemplateDialogueEngine } from "../game/dialogue/TemplateDialogueEngine";
import type { DialogueContext, WordFrame } from "../types/domain";

describe("TemplateDialogueEngine variety", () => {
  it("uses different learned words and parameters across repeated conversations", () => {
    const engine = new TemplateDialogueEngine();
    let words = createDebugWordSeed();
    const texts = new Set<string>();
    const usedWordIds = new Set<string>();
    const usedCategories = new Set<string>();
    const speechActs = new Set<string>();

    for (let index = 0; index < 24; index += 1) {
      const now = new Date(Date.UTC(2026, 6, 8, 9, index, 0)).toISOString();
      const context: DialogueContext = {
        profile: null,
        character_state: null,
        settings: null,
        words,
        now
      };
      const turn = engine.next(context);
      texts.add(turn.text);
      speechActs.add(turn.speech_act);

      words = words.map((word) => {
        const used = turn.used_words.find((item) => item.id === word.id);
        if (!used) return word;
        usedWordIds.add(word.id);
        usedCategories.add(word.category);
        return { ...word, use_count: word.use_count + 1, last_used_at: now, updated_at: now };
      });
    }

    expect(texts.size).toBeGreaterThanOrEqual(12);
    expect(usedWordIds.size).toBeGreaterThanOrEqual(12);
    expect(usedCategories.size).toBeGreaterThanOrEqual(5);
    expect(speechActs.size).toBeGreaterThanOrEqual(2);
  });

  it("does not use blocked or sensitive words in normal conversation", () => {
    const engine = new TemplateDialogueEngine();
    const words = createDebugWordSeed().map((word, index): WordFrame => {
      if (index === 0) return { ...word, surface: "出してはいけない語", is_blocked: true, confidence: 1, use_count: 0 };
      if (index === 1) return { ...word, surface: "通常会話では避ける語", is_sensitive: true, confidence: 1, use_count: 0 };
      return word;
    });

    const turn = engine.next({
      profile: null,
      character_state: null,
      settings: null,
      words,
      now: new Date(Date.UTC(2026, 6, 8, 9, 0, 0)).toISOString()
    });

    expect(turn.text).not.toContain("出してはいけない語");
    expect(turn.text).not.toContain("通常会話では避ける語");
    expect(turn.used_words.every((word) => !word.is_blocked && !word.is_sensitive)).toBe(true);
  });
});
