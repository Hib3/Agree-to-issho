import { describe, expect, it } from "vitest";
import { createDebugWordSeed } from "../data/debug/debugWordSeed";
import { generateDiaryEntryFromContext } from "../game/diary/generateDiaryEntry";

describe("diary generation", () => {
  it("uses multiple learned words with emotion and situation hints", () => {
    const words = createDebugWordSeed().slice(0, 4);
    const entry = generateDiaryEntryFromContext({
      profile: null,
      character_state: null,
      settings: null,
      words,
      now: "2026-07-08T09:00:00.000Z"
    });

    expect(entry.used_word_ids.length).toBeGreaterThanOrEqual(3);
    const quotedWords = entry.body.match(/「[^」]+」/g) ?? [];
    expect(new Set(quotedWords).size).toBeGreaterThanOrEqual(3);
    expect(entry.body).toMatch(/感じ/);
    expect(entry.body).toMatch(/会話|部屋|日記|思い出|場面|時/);
  });

  it("does not use forgotten words", () => {
    const [forgotten, usable] = createDebugWordSeed().slice(0, 2);
    const entry = generateDiaryEntryFromContext({
      profile: null,
      character_state: null,
      settings: null,
      words: [{ ...forgotten, forgotten_at: "2026-07-08T00:00:00.000Z" }, usable],
      now: "2026-07-08T09:00:00.000Z"
    });

    expect(entry.body).not.toContain(forgotten.surface);
    expect(entry.body).toContain(usable.surface);
  });

  it("prioritizes words used in today's dialogue logs and records drift notes", () => {
    const words = createDebugWordSeed().slice(0, 4);
    const talked = words[3];
    const entry = generateDiaryEntryFromContext({
      profile: null,
      character_state: null,
      settings: null,
      words,
      dialogue_logs: [{
        id: "log_test",
        speech_act: "misunderstanding_joke",
        text: `「${talked.surface}」を少しズレて使いました。`,
        used_word_ids: [talked.id],
        created_at: "2026-07-08T09:30:00.000Z"
      }],
      now: "2026-07-08T10:00:00.000Z"
    });

    expect(entry.used_word_ids[0]).toBe(talked.id);
    expect(entry.body).toContain(talked.surface);
    expect(entry.body).toContain("ズレた使い方");
  });
});
