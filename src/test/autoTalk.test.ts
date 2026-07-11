import { describe, expect, it } from "vitest";
import { getAutoTalkDelay, shouldScheduleAutoTalk } from "../game/dialogue/autoTalk";
import { SeededRandomSource } from "../game/dialogue/random";

describe("auto talk guard", () => {
  const base = { screen: "main-room" as const, enabled: true, hidden: false, busy: false, session: null, now: Date.now() };

  it("uses a reproducible 45 to 90 second delay", () => {
    const first = getAutoTalkDelay(new SeededRandomSource(42));
    const second = getAutoTalkDelay(new SeededRandomSource(42));
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(45000);
    expect(first).toBeLessThanOrEqual(90000);
  });

  it("schedules the idle timer immediately instead of waiting for another state change", () => {
    expect(shouldScheduleAutoTalk({
      ...base,
      lastUserInteractionAt: new Date(base.now).toISOString()
    })).toBe(true);
  });

  it("does not schedule while hidden, busy, or awaiting an answer", () => {
    expect(shouldScheduleAutoTalk({ ...base, hidden: true })).toBe(false);
    expect(shouldScheduleAutoTalk({ ...base, busy: true })).toBe(false);
    expect(shouldScheduleAutoTalk({
      ...base,
      session: { id: "s", intent: "review", phase: "awaiting_answer", topic_word_ids: [], remaining_turns: 2, started_at: "2026-01-01", updated_at: "2026-01-01" }
    })).toBe(false);
  });
});
