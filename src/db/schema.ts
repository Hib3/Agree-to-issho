import type {
  AppProfile,
  AssetManifestItem,
  CharacterState,
  DialogueLog,
  DialogueSummary,
  DiaryEntry,
  EventFlag,
  GameSettings,
  ImportBackup,
  WordFrame,
  WordRelation
} from "../types/domain";

export const DB_NAME = "with-agree-db";
export const DB_VERSION = 2;

export type StoreName =
  | "profile"
  | "character_state"
  | "words"
  | "word_relations"
  | "dialogue_logs"
  | "dialogue_summaries"
  | "event_flags"
  | "diary_entries"
  | "settings"
  | "import_backups"
  | "asset_manifest_cache";

export type StoreRecordMap = {
  profile: AppProfile;
  character_state: CharacterState;
  words: WordFrame;
  word_relations: WordRelation;
  dialogue_logs: DialogueLog;
  dialogue_summaries: DialogueSummary;
  event_flags: EventFlag;
  diary_entries: DiaryEntry;
  settings: GameSettings;
  import_backups: ImportBackup;
  asset_manifest_cache: AssetManifestItem;
};

export const storeNames: StoreName[] = [
  "profile",
  "character_state",
  "words",
  "word_relations",
  "dialogue_logs",
  "dialogue_summaries",
  "event_flags",
  "diary_entries",
  "settings",
  "import_backups",
  "asset_manifest_cache"
];
