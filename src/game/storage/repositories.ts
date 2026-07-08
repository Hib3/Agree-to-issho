import { appDb, findWordBySurface } from "../../db/indexedDb";
import { migrateWordFrame } from "../word/wordMemory";
import { storeNames, type StoreName, type StoreRecordMap } from "../../db/schema";
import type {
  AppProfile,
  CharacterState,
  DialogueLog,
  DialogueSummary,
  DiaryEntry,
  EventFlag,
  GameSettings,
  ImportBackup,
  WordFrame,
  WordRelation
} from "../../types/domain";

export function createRepository<TStore extends StoreName>(storeName: TStore) {
  return {
    get: (id: IDBValidKey) => appDb.get(storeName, id),
    list: () => appDb.getAll(storeName),
    save: (record: StoreRecordMap[TStore]) => appDb.put(storeName, record),
    remove: (id: IDBValidKey) => appDb.delete(storeName, id),
    clear: () => appDb.clear(storeName)
  };
}

export const profileRepository = {
  get: () => appDb.get("profile", "local"),
  save: (profile: AppProfile) => appDb.put("profile", profile),
  remove: () => appDb.delete("profile", "local")
};

export const characterStateRepository = {
  get: () => appDb.get("character_state", "main"),
  save: (state: CharacterState) => appDb.put("character_state", state),
  remove: () => appDb.delete("character_state", "main")
};

export const wordRepository = {
  async list() {
    const words = await appDb.getAll("words");
    return words.map((word) => migrateWordFrame(word));
  },
  async get(id: string) {
    const word = await appDb.get("words", id);
    return word ? migrateWordFrame(word) : undefined;
  },
  async findBySurface(surface: string) {
    const word = await findWordBySurface(surface);
    return word ? migrateWordFrame(word) : undefined;
  },
  save: (word: WordFrame) => appDb.put("words", migrateWordFrame(word)),
  remove: (id: string) => appDb.delete("words", id),
  clear: () => appDb.clear("words")
};

export const wordRelationRepository = createRepository("word_relations");
export const dialogueLogRepository = createRepository("dialogue_logs");
export const dialogueSummaryRepository = createRepository("dialogue_summaries");
export const eventFlagRepository = createRepository("event_flags");
export const diaryEntryRepository = createRepository("diary_entries");
export const importBackupRepository = createRepository("import_backups");
export const assetManifestCacheRepository = createRepository("asset_manifest_cache");

export const settingsRepository = {
  get: () => appDb.get("settings", "local"),
  save: (settings: GameSettings) => appDb.put("settings", settings),
  remove: () => appDb.delete("settings", "local")
};

export async function getAllSaveRecords() {
  const [
    profile,
    character_state,
    words,
    word_relations,
    dialogue_logs,
    dialogue_summaries,
    event_flags,
    diary_entries,
    settings,
    import_backups,
    asset_manifest_cache
  ] = await Promise.all([
    profileRepository.get(),
    characterStateRepository.get(),
    wordRepository.list(),
    wordRelationRepository.list(),
    dialogueLogRepository.list(),
    dialogueSummaryRepository.list(),
    eventFlagRepository.list(),
    diaryEntryRepository.list(),
    settingsRepository.get(),
    importBackupRepository.list(),
    assetManifestCacheRepository.list()
  ]);

  return {
    profile: profile ?? null,
    character_state: character_state ?? null,
    words,
    word_relations: word_relations as WordRelation[],
    dialogue_logs: dialogue_logs as DialogueLog[],
    dialogue_summaries: dialogue_summaries as DialogueSummary[],
    event_flags: event_flags as EventFlag[],
    diary_entries: diary_entries as DiaryEntry[],
    settings: settings ?? null,
    import_backups: import_backups as ImportBackup[],
    asset_manifest_cache: asset_manifest_cache
  };
}

export async function clearGameStores(includeBackups = false) {
  const clearable = includeBackups ? storeNames : storeNames.filter((name) => name !== "import_backups");
  for (const storeName of clearable) {
    await appDb.clear(storeName);
  }
}
