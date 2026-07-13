import Dexie, { type EntityTable } from "dexie";
import type { CharacterState } from "../../domain/model/character";
import type { Concept } from "../../domain/model/concept";
import type { ConversationSession, DialogueHistoryEntry } from "../../domain/model/conversation";
import type { DiaryEntry, MemoryEvent } from "../../domain/model/memory";
import type { GameSettings, PlayerProfile } from "../../domain/model/player";
import type { ConceptRelation } from "../../domain/model/relation";
import type { LearningSession } from "../../domain/learning/learningMachine";
import { CLEANROOM_DB_NAME, type ImportBackupRecord, type MigrationLog } from "./schema";
import { migrateConversationSession } from "../../domain/conversation/sessionMigration";

const stores = {
  player: "id",
  character: "id, currentLocationId, updatedAt",
  concepts: "id, source, normalized, userCategory, learnedAt, active",
  relations: "id, fromConceptId, toConceptId, type, reinforcedAt",
  memories: "id, type, locationId, createdAt, *conceptIds",
  conversationSessions: "id, phase, intent, locationId, updatedAt",
  dialogueHistory: "id, sessionId, intent, locationId, createdAt, *conceptIds",
  diaries: "id, date, createdAt",
  settings: "id",
  learningSessions: "id, state, updatedAt",
  importBackups: "id, createdAt",
  migrationLogs: "id, legacyDatabase, importedAt"
};

export class AguriDatabase extends Dexie {
  player!: EntityTable<PlayerProfile, "id">;
  character!: EntityTable<CharacterState, "id">;
  concepts!: EntityTable<Concept, "id">;
  relations!: EntityTable<ConceptRelation, "id">;
  memories!: EntityTable<MemoryEvent, "id">;
  conversationSessions!: EntityTable<ConversationSession, "id">;
  dialogueHistory!: EntityTable<DialogueHistoryEntry, "id">;
  diaries!: EntityTable<DiaryEntry, "id">;
  settings!: EntityTable<GameSettings, "id">;
  learningSessions!: EntityTable<LearningSession, "id">;
  importBackups!: EntityTable<ImportBackupRecord, "id">;
  migrationLogs!: EntityTable<MigrationLog, "id">;

  constructor(name = CLEANROOM_DB_NAME) {
    super(name);
    this.version(1).stores(stores);
    this.version(2).stores(stores).upgrade((transaction) =>
      transaction
        .table<ConversationSession>("conversationSessions")
        .toCollection()
        .modify((session) => {
          Object.assign(session, migrateConversationSession(session));
        })
    );
  }
}

export const db = new AguriDatabase();
