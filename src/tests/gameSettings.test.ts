import { describe, expect, it } from "vitest";
import { createDefaultSettings, migrateGameSettings } from "../domain/settings/gameSettings";

describe("game settings migration", () => {
  it("starts with working sound enabled and news disabled", () => {
    const settings = createDefaultSettings(100);
    expect(settings.muted).toBe(false);
    expect(settings.audioRevision).toBe(1);
    expect(settings.newsEnabled).toBe(false);
    expect(settings.newsFeeds).toEqual([]);
    expect(settings.newsUseFeedDiscoveryHelper).toBe(false);
    expect(settings.newsUseFeedFetchHelper).toBe(false);
    expect(settings.newsUseArticleHelper).toBe(false);
  });

  it("unmutes legacy settings because the old mute control had no audio implementation", () => {
    const settings = migrateGameSettings({
      id: "local",
      textSpeed: "normal",
      fontScale: "normal",
      highContrast: false,
      reducedMotion: false,
      volume: 0.6,
      muted: true,
      autonomousSpeech: true,
      updatedAt: 10
    }, 100);
    expect(settings.muted).toBe(false);
    expect(settings.audioRevision).toBe(1);
  });

  it("preserves an intentional mute after the audio revision is installed", () => {
    const settings = migrateGameSettings({ ...createDefaultSettings(10), muted: true }, 100);
    expect(settings.muted).toBe(true);
  });
});
