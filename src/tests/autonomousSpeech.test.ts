import { describe, expect, it } from "vitest";
import { locations } from "../data/locations/locations";
import type { CharacterState } from "../domain/model/character";
import { autonomousDelayMs, canScheduleAutonomousSpeech } from "../domain/schedule/autonomousSpeech";

const daytime = new Date(2026, 6, 13, 14, 0, 0).getTime();
const character: CharacterState = {
  id: "aguri",
  name: "アグリちゃん",
  emotion: "curious",
  energy: 72,
  closeness: 35,
  curiosity: 0.8,
  socialNeed: 30,
  trust: 40,
  boredom: 24,
  currentLocationId: "room",
  lastUserInteractionAt: daytime - 13_000,
  lastSpeechAt: daytime - 20_000,
  updatedAt: daytime
};

describe("autonomous conversation schedule", () => {
  it("starts only while the room is visible, focused and idle", () => {
    const context = {
      screen: "room",
      documentVisible: true,
      documentFocused: true,
      isBusy: false,
      isInputting: false,
      hasPendingAnswer: false,
      character,
      location: locations[0]!,
      now: daytime
    };
    expect(canScheduleAutonomousSpeech(context)).toBe(true);
    expect(canScheduleAutonomousSpeech({ ...context, documentVisible: false })).toBe(false);
    expect(canScheduleAutonomousSpeech({ ...context, hasPendingAnswer: true })).toBe(false);
    expect(canScheduleAutonomousSpeech({ ...context, isInputting: true })).toBe(false);
    expect(canScheduleAutonomousSpeech({ ...context, now: character.lastUserInteractionAt + 8_000 })).toBe(
      false
    );
  });

  it("keeps each location delay inside its configured short idle window", () => {
    for (const location of locations) {
      const minimum = autonomousDelayMs(location, { next: () => 0 });
      const maximum = autonomousDelayMs(location, { next: () => 0.999999 });
      expect(minimum).toBe(location.autoSpeechRangeSeconds[0] * 1000);
      expect(maximum).toBe(location.autoSpeechRangeSeconds[1] * 1000);
      expect(maximum).toBeLessThanOrEqual(60_000);
    }
  });
});
