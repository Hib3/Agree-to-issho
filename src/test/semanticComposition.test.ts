import { describe, expect, it } from "vitest";
import { composeLearnedScene } from "../game/dialogue/semanticComposition";
import { SeededRandomSource } from "../game/dialogue/random";
import { applyCategory, createWordFrame } from "../game/word/createWordFrame";
import type { DialogueLog, WordCategory, WordFrame } from "../types/domain";

function word(surface: string, category: WordCategory, patch: Partial<WordFrame> = {}) {
  return { ...applyCategory(createWordFrame(surface), category), ...patch };
}

describe("learned-word semantic composition", () => {
  it("fills a grounded scene with category-compatible learned words", () => {
    const place = word("ひだまり通り", "place");
    const action = word("散歩", "action");
    const item = word("水筒", "object");
    const result = composeLearnedScene(place, [place, action, item], [], false, new SeededRandomSource(12));

    expect(result?.drifted).toBe(false);
    expect(result?.words).toHaveLength(3);
    expect(result?.words.map((item) => item.category).sort()).toEqual(["action", "object", "place"]);
    for (const learned of [place, action, item]) expect(result?.text).toContain(learned.surface);
    expect(result?.text).not.toMatch(/\{\w+\}|undefined/);
  });

  it("keeps grammar around quoted words while drifting one semantic role", () => {
    const object = word("古いラジオ", "object", { ambiguity_score: 0.9, drift_level: 3 });
    const action = word("遠足", "action");
    const food = word("プリン", "food");
    const result = composeLearnedScene(object, [object, action, food], [], true, new SeededRandomSource(3));

    expect(result?.drifted).toBe(true);
    expect(result?.semanticKey).toContain("composition.drift.single_role");
    expect(result?.words.length).toBeGreaterThanOrEqual(2);
    expect(result?.text).toContain("古いラジオ");
    expect(result?.text).toMatch(/[。？！]$/);
  });

  it("never composes blocked, sensitive, or forgotten words", () => {
    const place = word("公園", "place");
    const action = word("読書", "action");
    const blocked = word("非表示語", "object", { is_blocked: true });
    const sensitive = word("慎重語", "food", { is_sensitive: true });
    const forgotten = word("忘れた語", "object", { forgotten_at: "2026-07-11T00:00:00.000Z" });
    const result = composeLearnedScene(place, [place, action, blocked, sensitive, forgotten], [], false, new SeededRandomSource(1));

    expect(result?.words.map((item) => item.surface)).not.toEqual(expect.arrayContaining(["非表示語", "慎重語", "忘れた語"]));
  });

  it("does not reuse words from the last three character turns", () => {
    const place = word("駅前", "place");
    const recent = word("買い物", "action");
    const fresh = word("待ち合わせ", "action");
    const item = word("手帳", "object");
    const logs: DialogueLog[] = [{
      id: "recent",
      role: "character",
      text: "前の会話",
      used_word_ids: [recent.id],
      created_at: "2026-07-11T00:00:00.000Z"
    }];
    const result = composeLearnedScene(place, [place, recent, fresh, item], logs, false, new SeededRandomSource(8));

    expect(result?.words.map((item) => item.id)).not.toContain(recent.id);
    expect(result?.words.map((item) => item.id)).toContain(fresh.id);
  });
});
