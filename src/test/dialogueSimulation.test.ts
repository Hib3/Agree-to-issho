import { describe, expect, it } from "vitest";
import { createDebugWordSeed } from "../data/debug/debugWordSeed";
import { SeededRandomSource } from "../game/dialogue/random";
import { TemplateDialogueEngine } from "../game/dialogue/TemplateDialogueEngine";
import type { DialogueLog } from "../types/domain";

describe("500 turn conversation simulation", () => {
  it("varies text, templates, semantics, acts, and learned words", () => {
    const engine = new TemplateDialogueEngine(new SeededRandomSource(4386));
    let words = createDebugWordSeed();
    const logs: DialogueLog[] = [];
    const usedIds = new Set<string>();
    let relaxedTurns = 0;

    for (let index = 0; index < 500; index += 1) {
      const now = new Date(Date.UTC(2026, 6, 11, 9, index, 0)).toISOString();
      const turn = engine.next({ profile: null, character_state: null, settings: null, words, dialogue_logs: logs, now });
      expect(turn.text.trim()).not.toBe("");
      expect(turn.text).not.toMatch(/\{\w+\}|undefined|NaN/);

      const recent = logs.slice(-8);
      expect(recent.some((log) => log.text === turn.text)).toBe(false);
      if (recent.some((log) => log.template_id === turn.template_id)) {
        expect(turn.relaxed_constraints ?? []).toContain("template_id_cooldown");
        relaxedTurns += 1;
      }
      if (turn.semantic_key && logs.slice(-5).some((log) => log.semantic_key === turn.semantic_key)) {
        expect(turn.relaxed_constraints ?? []).toContain("semantic_key_cooldown");
        relaxedTurns += 1;
      }
      for (const word of turn.used_words) {
        const recentWordIds = logs.slice(-3).flatMap((log) => log.used_word_ids);
        expect(recentWordIds).not.toContain(word.id);
        usedIds.add(word.id);
      }
      const recentActs = logs.slice(-2).map((log) => log.speech_act);
      if (recentActs.length === 2 && recentActs.every((act) => act === turn.speech_act)) {
        expect(turn.relaxed_constraints ?? []).toContain("speech_act_cooldown");
      }
      const recentCategories = logs.slice(-2)
        .map((log) => words.find((word) => log.used_word_ids.includes(word.id))?.category)
        .filter(Boolean);
      if (turn.used_words[0] && recentCategories.length === 2 && recentCategories.every((category) => category === turn.used_words[0].category)) {
        expect(turn.relaxed_constraints ?? []).toContain("word_category_cooldown");
      }

      logs.push({
        id: `log_${index}`,
        session_id: turn.session_id,
        role: "character",
        speech_act: turn.speech_act,
        template_id: turn.template_id,
        semantic_key: turn.semantic_key,
        text: turn.text,
        used_word_ids: turn.used_words.map((word) => word.id),
        created_at: now
      });
      words = words.map((word) => turn.used_words.some((used) => used.id === word.id)
        ? { ...word, use_count: word.use_count + 1, last_used_at: now, updated_at: now }
        : word);
    }

    expect(logs).toHaveLength(500);
    expect(usedIds.size).toBeGreaterThanOrEqual(75);
    expect(new Set(logs.map((log) => log.text)).size).toBeGreaterThanOrEqual(400);
    expect(relaxedTurns).toBeGreaterThan(0);
  });
});
