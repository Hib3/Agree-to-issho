import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLearningSession } from "../domain/learning/learningMachine";
import { createDefaultSettings } from "../domain/settings/gameSettings";
import { checksum } from "../infrastructure/backup/checksum";
import { applyImport, previewImport } from "../infrastructure/backup/importSave";
import { db } from "../infrastructure/db/database";

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

afterEach(async () => {
  db.close();
  await db.delete();
});

describe("backup schema compatibility", () => {
  it("validates schema 3 settings with RSS configuration", async () => {
    const unsigned = {
      appId: "aguri-cleanroom" as const,
      schemaVersion: 3 as const,
      buildId: "test",
      exportedAt: 100,
      player: null,
      character: null,
      concepts: [],
      relations: [],
      memories: [],
      conversationSessions: [],
      dialogueHistory: [],
      diaries: [],
      settings: {
        ...createDefaultSettings(100),
        newsEnabled: true,
        newsFeeds: [
          {
            id: "feed_one",
            name: "町の通信",
            url: "https://example.com/feed.xml",
            enabled: true,
            addedAt: 100
          }
        ]
      }
    };
    const preview = await previewImport(JSON.stringify({ ...unsigned, checksum: await checksum(unsigned) }));
    expect(preview.valid).toBe(true);
    expect(preview.data?.settings?.newsFeeds?.[0]?.name).toBe("町の通信");
  });

  it("continues to validate schema 2 backups without new settings fields", async () => {
    const unsigned = {
      appId: "aguri-cleanroom" as const,
      schemaVersion: 2 as const,
      exportedAt: 100,
      player: null,
      character: null,
      concepts: [],
      relations: [],
      memories: [],
      conversationSessions: [],
      dialogueHistory: [],
      diaries: [],
      settings: {
        id: "local" as const,
        textSpeed: "normal" as const,
        fontScale: "normal" as const,
        highContrast: false,
        reducedMotion: false,
        volume: 0.7,
        muted: true,
        autonomousSpeech: true,
        updatedAt: 100
      }
    };
    const preview = await previewImport(JSON.stringify({ ...unsigned, checksum: await checksum(unsigned) }));
    expect(preview.valid).toBe(true);
  });

  it("clears unfinished learning and resets all external-helper consent on replace import", async () => {
    await db.learningSessions.put(createLearningSession("room_object", 50));
    const unsigned = {
      appId: "aguri-cleanroom" as const,
      schemaVersion: 3 as const,
      buildId: "test",
      exportedAt: 100,
      player: null,
      character: null,
      concepts: [],
      relations: [],
      memories: [],
      conversationSessions: [],
      dialogueHistory: [],
      diaries: [],
      settings: {
        ...createDefaultSettings(100),
        newsUseFeedDiscoveryHelper: true,
        newsUseFeedFetchHelper: true,
        newsUseArticleHelper: true
      }
    };
    const preview = await previewImport(JSON.stringify({ ...unsigned, checksum: await checksum(unsigned) }));
    await applyImport(preview, "replace", 200);
    const imported = await db.settings.get("local");
    expect(await db.learningSessions.count()).toBe(0);
    expect(imported).toMatchObject({
      newsUseFeedDiscoveryHelper: false,
      newsUseFeedFetchHelper: false,
      newsUseArticleHelper: false
    });
  });
});
