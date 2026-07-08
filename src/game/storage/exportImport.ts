import type { ExportedSaveData, ImportBackup, ImportPreview, WordFrame } from "../../types/domain";
import { createId, nowIso } from "../../utils/id";
import {
  characterStateRepository,
  clearGameStores,
  diaryEntryRepository,
  dialogueSummaryRepository,
  eventFlagRepository,
  getAllSaveRecords,
  importBackupRepository,
  profileRepository,
  settingsRepository,
  wordRelationRepository,
  wordRepository
} from "./repositories";
import { checksumJson } from "./checksum";

const APP_ID = "aguri-word-room";
const LEGACY_APP_IDS = ["with-agree"];
const APP_VERSION = "0.1.0";

export async function exportSaveData(): Promise<ExportedSaveData> {
  const records = await getAllSaveRecords();
  const data: ExportedSaveData = {
    schema_version: 1,
    app_id: APP_ID,
    exported_at: nowIso(),
    app_version: APP_VERSION,
    profile: records.profile,
    character_state: records.character_state,
    words: records.words,
    word_relations: records.word_relations,
    diary_entries: records.diary_entries,
    dialogue_summaries: records.dialogue_summaries,
    event_flags: records.event_flags,
    settings: records.settings,
    checksum: ""
  };
  return { ...data, checksum: await checksumJson(data) };
}

export async function previewImport(raw: string, mode: "replace" | "merge"): Promise<ImportPreview> {
  try {
    const data = JSON.parse(raw) as ExportedSaveData;
    const errors: string[] = [];
    if (data.schema_version !== 1) errors.push("このセーブ形式はまだ読み込めません。");
    if (data.app_id !== APP_ID && !LEGACY_APP_IDS.includes(data.app_id)) errors.push("別のアプリの保存データです。");
    const expected = await checksumJson(data);
    if (expected !== data.checksum) errors.push("保存データの確認に失敗しました。");
    if (!Array.isArray(data.words)) errors.push("言葉の一覧を読み込めません。");

    const currentWords = await wordRepository.list();
    const conflict_surfaces = findSurfaceConflicts(currentWords, Array.isArray(data.words) ? data.words : []);

    return {
      valid: errors.length === 0,
      mode,
      word_count: Array.isArray(data.words) ? data.words.length : 0,
      diary_count: Array.isArray(data.diary_entries) ? data.diary_entries.length : 0,
      conflict_surfaces,
      errors,
      data: errors.length === 0 ? data : undefined
    };
  } catch {
    return {
      valid: false,
      mode,
      word_count: 0,
      diary_count: 0,
      conflict_surfaces: [],
      errors: ["JSONを読み込めません。"]
    };
  }
}

export async function importSaveData(preview: ImportPreview): Promise<void> {
  if (!preview.valid || !preview.data) throw new Error("読み込み前の確認に失敗しました。");
  const backup: ImportBackup = {
    id: createId("backup"),
    created_at: nowIso(),
    reason: `pre_import_${preview.mode}`,
    data: await exportSaveData()
  };
  await importBackupRepository.save(backup);

  if (preview.mode === "replace") {
    await clearGameStores(false);
  }

  const data = preview.data;
  if (data.profile) await profileRepository.save(data.profile);
  if (data.character_state) await characterStateRepository.save(data.character_state);
  if (data.settings) await settingsRepository.save(data.settings);

  for (const word of data.words) {
    await saveMergedWord(word);
  }
  for (const relation of data.word_relations) await wordRelationRepository.save(relation);
  for (const entry of data.diary_entries) await diaryEntryRepository.save(entry);
  for (const summary of data.dialogue_summaries) await dialogueSummaryRepository.save(summary);
  for (const flag of data.event_flags) await eventFlagRepository.save(flag);
}

function findSurfaceConflicts(current: WordFrame[], incoming: WordFrame[]): string[] {
  const currentSurfaces = new Set(current.map((word) => word.surface));
  return incoming.filter((word) => currentSurfaces.has(word.surface)).map((word) => word.surface);
}

async function saveMergedWord(incoming: WordFrame): Promise<void> {
  const existing = await wordRepository.findBySurface(incoming.surface);
  if (!existing || incoming.confidence >= existing.confidence) {
    await wordRepository.save(incoming);
  }
}
