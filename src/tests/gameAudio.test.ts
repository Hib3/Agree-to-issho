import { describe, expect, it } from "vitest";
import { isGameSoundEnabled } from "../infrastructure/audio/gameAudio";

describe("game audio settings", () => {
  it("enables sound only when volume is audible and mute is off", () => {
    expect(isGameSoundEnabled({ muted: false, volume: 0.7 })).toBe(true);
    expect(isGameSoundEnabled({ muted: true, volume: 0.7 })).toBe(false);
    expect(isGameSoundEnabled({ muted: false, volume: 0 })).toBe(false);
  });
});
