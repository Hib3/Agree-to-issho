import { db } from "../db/database";
import { checksum } from "./checksum";

export async function createExportData(now = Date.now()) {
  const [player, character, concepts, relations, memories, conversationSessions, dialogueHistory, diaries, settings] =
    await Promise.all([
      db.player.get("local"),
      db.character.get("aguri"),
      db.concepts.toArray(),
      db.relations.toArray(),
      db.memories.toArray(),
      db.conversationSessions.toArray(),
      db.dialogueHistory.toArray(),
      db.diaries.toArray(),
      db.settings.get("local")
    ]);
  const unsigned = {
    appId: "aguri-cleanroom" as const,
    schemaVersion: 1 as const,
    exportedAt: now,
    player: player ?? null,
    character: character ?? null,
    concepts,
    relations,
    memories,
    conversationSessions,
    dialogueHistory,
    diaries,
    settings: settings ?? null
  };
  return { ...unsigned, checksum: await checksum(unsigned) };
}

export async function exportSaveFile() {
  const data = await createExportData();
  return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
}
