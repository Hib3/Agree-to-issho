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
});
