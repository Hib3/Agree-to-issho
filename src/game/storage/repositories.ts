import { appDb, findWordBySurface } from "../../db/indexedDb";
import { migrateWordFrame } from "../word/wordMemory";
import { storeNames, type StoreName, type StoreRecordMap } from "../../db/schema";
import type {
  AppProfile,
  CharacterState,
  ConversationSession,
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
  async get() {
    const state = await appDb.get("character_state", "main");
    return state ? migrateCharacterState(state) : undefined;
  },
  save: (state: CharacterState) => appDb.put("character_state", migrateCharacterState(state)),
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
export const dialogueLogRepository = {
  async list() {
    return (await appDb.getAll("dialogue_logs")).map(migrateDialogueLog);
  },
  async get(id: string) {
    const log = await appDb.get("dialogue_logs", id);
    return log ? migrateDialogueLog(log) : undefined;
  },
  save: (log: DialogueLog) => appDb.put("dialogue_logs", migrateDialogueLog(log)),
  remove: (id: string) => appDb.delete("dialogue_logs", id),
  clear: () => appDb.clear("dialogue_logs")
};
export const conversationSessionRepository = createRepository("conversation_sessions");
export const dialogueSummaryRepository = createRepository("dialogue_summaries");
export const eventFlagRepository = createRepository("event_flags");
export const diaryEntryRepository = createRepository("diary_entries");
export const importBackupRepository = createRepository("import_backups");
export const assetManifestCacheRepository = createRepository("asset_manifest_cache");

export const settingsRepository = {
  async get() {
    const settings = await appDb.get("settings", "local");
    return settings ? migrateSettings(settings) : undefined;
  },
  save: (settings: GameSettings) => appDb.put("settings", migrateSettings(settings)),
  remove: () => appDb.delete("settings", "local")
};

function migrateSettings(settings: Partial<GameSettings> & Pick<GameSettings, "id">): GameSettings {
  return {
    id: settings.id,
    reduce_motion: settings.reduce_motion ?? false,
    text_speed: settings.text_speed ?? "normal",
    autosave: settings.autosave ?? true,
    auto_talk: settings.auto_talk ?? true,
    debug_panel: settings.debug_panel ?? false,
    updated_at: settings.updated_at ?? new Date().toISOString()
  };
}

export function migrateCharacterState(state: Partial<CharacterState> & Pick<CharacterState, "id" | "character_name">): CharacterState {
  const legacyInteraction = state.last_interaction_at;
  const updatedAt = state.updated_at ?? legacyInteraction ?? new Date().toISOString();
  const elapsedHours = Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 3600000);
  const recoveredEnergy = clamp((state.energy ?? 100) + Math.floor(elapsedHours * 2), 0, 100);
  return {
    id: state.id,
    character_name: state.character_name,
    expression: state.expression ?? "idle_normal",
    affection: clamp(state.affection ?? 0, 0, 100),
    energy: recoveredEnergy,
    ...(legacyInteraction ? { last_interaction_at: legacyInteraction } : {}),
    ...(state.last_user_interaction_at ?? legacyInteraction ? { last_user_interaction_at: state.last_user_interaction_at ?? legacyInteraction } : {}),
    ...(state.last_character_speech_at ?? legacyInteraction ? { last_character_speech_at: state.last_character_speech_at ?? legacyInteraction } : {}),
    ...(state.idle_motion ? { idle_motion: state.idle_motion } : {}),
    updated_at: updatedAt
  };
}

export function migrateDialogueLog(log: Partial<DialogueLog> & Pick<DialogueLog, "id" | "text" | "created_at">): DialogueLog {
  return {
    id: log.id,
    session_id: log.session_id ?? `legacy_${log.id}`,
    role: log.role ?? "character",
    ...(log.speech_act ? { speech_act: log.speech_act } : {}),
    ...(log.template_id ? { template_id: log.template_id } : {}),
    ...(log.semantic_key ? { semantic_key: log.semantic_key } : {}),
    text: log.text,
    used_word_ids: log.used_word_ids ?? [],
    ...(log.reply_to_log_id ? { reply_to_log_id: log.reply_to_log_id } : {}),
    ...(log.player_action ? { player_action: log.player_action } : {}),
    ...(log.selected_option_id ? { selected_option_id: log.selected_option_id } : {}),
    ...(log.emotion_code ? { emotion_code: log.emotion_code } : {}),
    ...(log.motion_hint ? { motion_hint: log.motion_hint } : {}),
    created_at: log.created_at
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export async function getAllSaveRecords() {
  const [
    profile,
    character_state,
    words,
    word_relations,
    dialogue_logs,
    conversation_sessions,
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
    conversationSessionRepository.list(),
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
    conversation_sessions: conversation_sessions as ConversationSession[],
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
