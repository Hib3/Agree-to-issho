import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { exportSaveData, importSaveData, previewImport } from "../game/storage/exportImport";
import { clearGameStores, conversationSessionRepository, dialogueLogRepository, wordRepository } from "../game/storage/repositories";
import { checksumJson } from "../game/storage/checksum";
import { applyCategory, createWordFrame } from "../game/word/createWordFrame";

describe("save import/export", () => {
  beforeEach(async () => {
    await clearGameStores(true);
  });

  it("exports valid JSON and imports it with checksum validation", async () => {
    await wordRepository.save(applyCategory(createWordFrame("あかり"), "idea"));
    const exported = await exportSaveData();
    const preview = await previewImport(JSON.stringify(exported), "replace");

    expect(exported.schema_version).toBe(3);
    expect(preview.valid).toBe(true);
    expect(preview.word_count).toBe(1);

    await clearGameStores(true);
    await importSaveData(preview);
    const imported = await wordRepository.findBySurface("あかり");
    expect(imported).toBeTruthy();
    expect(imported?.memory_strength).toBeGreaterThan(0);
  });

  it("rejects broken JSON", async () => {
    const preview = await previewImport("{broken", "merge");
    expect(preview.valid).toBe(false);
  });

  it.each([1, 2] as const)("migrates schema %s without new dialogue fields", async (schemaVersion) => {
    const word = applyCategory(createWordFrame(`旧データ${schemaVersion}`), "idea");
    const legacy = {
      schema_version: schemaVersion,
      app_id: "aguri-word-room",
      exported_at: "2026-07-11T00:00:00.000Z",
      app_version: "0.1.0",
      profile: null,
      character_state: null,
      words: [word],
      word_relations: [],
      diary_entries: [],
      dialogue_summaries: [],
      event_flags: [],
      settings: null,
      checksum: ""
    };
    legacy.checksum = await checksumJson(legacy);
    const preview = await previewImport(JSON.stringify(legacy), "replace");
    expect(preview.valid).toBe(true);
    expect(preview.data?.schema_version).toBe(3);
    expect(preview.data?.dialogue_logs).toEqual([]);
    expect(preview.data?.conversation_sessions).toEqual([]);
    await importSaveData(preview);
    expect(await wordRepository.findBySurface(`旧データ${schemaVersion}`)).toBeTruthy();
  });

  it("restores dialogue history and sessions and merge does not duplicate ids", async () => {
    const now = "2026-07-11T09:00:00.000Z";
    await dialogueLogRepository.save({ id: "log_1", session_id: "session_1", role: "character", speech_act: "ask_emotion", text: "質問", used_word_ids: [], created_at: now });
    await conversationSessionRepository.save({ id: "session_1", intent: "review.preference.direct", phase: "awaiting_answer", topic_word_ids: [], question_kind: "single_choice", remaining_turns: 2, started_at: now, updated_at: now });
    const exported = await exportSaveData();
    const preview = await previewImport(JSON.stringify(exported), "merge");
    await importSaveData(preview);
    expect((await dialogueLogRepository.list()).filter((log) => log.id === "log_1")).toHaveLength(1);
    expect((await conversationSessionRepository.list()).filter((session) => session.id === "session_1")).toHaveLength(1);
  });
});
