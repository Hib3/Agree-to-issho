import type { GameSettings } from "../model/player";

export const CURRENT_AUDIO_REVISION = 1 as const;

type MigratableSettings = {
  [Key in keyof GameSettings]?: GameSettings[Key] | undefined;
};

export function createDefaultSettings(now = Date.now()): GameSettings {
  return {
    id: "local",
    textSpeed: "normal",
    fontScale: "normal",
    highContrast: false,
    reducedMotion: false,
    volume: 0.7,
    muted: false,
    audioRevision: CURRENT_AUDIO_REVISION,
    autonomousSpeech: true,
    newsEnabled: false,
    newsRefreshMinutes: 30,
    newsUseRss2Json: false,
    newsFeeds: [],
    updatedAt: now
  };
}

export function migrateGameSettings(settings: MigratableSettings, now = Date.now()): GameSettings {
  const defaults = createDefaultSettings(now);
  const hadWorkingAudio = settings.audioRevision === CURRENT_AUDIO_REVISION;
  const refreshMinutes = [15, 30, 60, 180].includes(Number(settings.newsRefreshMinutes))
    ? (settings.newsRefreshMinutes as GameSettings["newsRefreshMinutes"])
    : defaults.newsRefreshMinutes;
  return {
    id: "local",
    textSpeed: settings.textSpeed ?? defaults.textSpeed,
    fontScale: settings.fontScale ?? defaults.fontScale,
    highContrast: settings.highContrast ?? defaults.highContrast,
    reducedMotion: settings.reducedMotion ?? defaults.reducedMotion,
    volume: clampVolume(settings.volume ?? defaults.volume),
    muted: hadWorkingAudio ? Boolean(settings.muted) : false,
    audioRevision: CURRENT_AUDIO_REVISION,
    autonomousSpeech: settings.autonomousSpeech ?? defaults.autonomousSpeech,
    newsEnabled: settings.newsEnabled ?? defaults.newsEnabled,
    newsRefreshMinutes: refreshMinutes,
    newsUseRss2Json: settings.newsUseRss2Json ?? defaults.newsUseRss2Json,
    newsFeeds: Array.isArray(settings.newsFeeds) ? settings.newsFeeds : [],
    updatedAt: settings.updatedAt ?? now
  };
}

function clampVolume(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.7));
}
