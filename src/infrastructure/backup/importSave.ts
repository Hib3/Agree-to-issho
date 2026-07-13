import { backupSchema } from "../../data/schema/runtimeSchemas";
import { db } from "../db/database";
import { checksum } from "./checksum";
import { createExportData } from "./exportSave";
import type { Concept } from "../../domain/model/concept";
import type { ConversationSession, DialogueHistoryEntry } from "../../domain/model/conversation";
import type { MemoryEvent } from "../../domain/model/memory";
import { migrateConversationSession } from "../../domain/conversation/sessionMigration";
import { migrateGameSettings } from "../../domain/settings/gameSettings";

export type ImportMode = "replace" | "merge";
export type ImportPreview = {
  valid: boolean;
  errors: string[];
  unknownFields: string[];
  counts: Record<string, number>;
  data?: ReturnType<typeof backupSchema.parse>;
};

export async function previewImport(json: string): Promise<ImportPreview> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { valid: false, errors: ["JSONを読み取れません。"], unknownFields: [], counts: {} };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const rawKeys = raw && typeof raw === "object" ? Object.keys(raw) : [];
    const known = new Set(Object.keys(backupSchema.shape));
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      unknownFields: rawKeys.filter((key) => !known.has(key)),
      counts: {}
    };
  }
  const { checksum: provided, ...unsigned } = parsed.data;
  const validChecksum = provided === (await checksum(unsigned));
  return {
    valid: validChecksum,
    errors: validChecksum ? [] : ["チェックサムが一致しません。"],
    unknownFields: [],
    counts: {
      concepts: parsed.data.concepts.length,
      relations: parsed.data.relations.length,
      memories: parsed.data.memories.length,
      sessions: parsed.data.conversationSessions.length,
      diaries: parsed.data.diaries.length
    },
    data: parsed.data
  };
}

export async function applyImport(preview: ImportPreview, mode: ImportMode, now = Date.now()) {
  if (!preview.valid || !preview.data) throw new Error("検証済みのバックアップではありません。");
  const data = preview.data;
  const current = await createExportData(now);
  await db.transaction("rw", db.tables, async () => {
    await db.importBackups.put({
      id: `backup_${crypto.randomUUID()}`,
      createdAt: now,
      reason: "pre_import",
      json: JSON.stringify(current)
    });
    if (mode === "replace") {
      for (const table of [
        db.player,
        db.character,
        db.concepts,
        db.relations,
        db.memories,
        db.conversationSessions,
        db.dialogueHistory,
        db.diaries,
        db.settings,
        db.learningSessions,
        db.newsItems
      ]) {
        await table.clear();
      }
    }
    if (data.player) await db.player.put(data.player);
    if (data.character) await db.character.put(data.character);
    await db.concepts.bulkPut(data.concepts as Concept[]);
    await db.relations.bulkPut(data.relations);
    await db.memories.bulkPut(data.memories as MemoryEvent[]);
    await db.conversationSessions.bulkPut(
      (data.conversationSessions as ConversationSession[]).map((session) =>
        migrateConversationSession(session, now)
      )
    );
    await db.dialogueHistory.bulkPut(data.dialogueHistory as DialogueHistoryEntry[]);
    await db.diaries.bulkPut(data.diaries);
    if (data.settings) {
      if (mode === "merge") await db.newsItems.clear();
      const importedSettings = migrateGameSettings(data.settings, now);
      await db.settings.put({
        ...importedSettings,
        newsUseFeedDiscoveryHelper: false,
        newsUseFeedFetchHelper: false,
        newsUseArticleHelper: false
      });
    }
  });
}
