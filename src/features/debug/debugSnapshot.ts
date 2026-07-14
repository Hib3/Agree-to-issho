import {
  APP_SCHEMA_VERSION,
  BUILD_ID,
  GIT_SHA,
  INDEXED_DB_VERSION,
  SERVICE_WORKER_RUNTIME_CACHE
} from "../../app/buildInfo";
import { db } from "../../infrastructure/db/database";

export async function createDebugSnapshot() {
  const [words, relations, sessions, dialogue, settings] = await Promise.all([
    db.concepts.toArray(),
    db.relations.toArray(),
    db.conversationSessions.orderBy("updatedAt").reverse().limit(10).toArray(),
    db.dialogueHistory.orderBy("createdAt").reverse().limit(30).toArray(),
    db.settings.get("local")
  ]);
  const activeSession = sessions.find((session) => session.phase !== "completed") ?? null;
  const currentTurn = activeSession?.history.at(-1) ?? activeSession?.queuedTurns[0] ?? null;
  return {
    schemaVersion: APP_SCHEMA_VERSION,
    buildId: BUILD_ID,
    gitSha: GIT_SHA,
    serviceWorkerCache: SERVICE_WORKER_RUNTIME_CACHE,
    indexedDbVersion: INDEXED_DB_VERSION,
    words,
    relations,
    recentDialogue: dialogue,
    activeSession,
    currentTurn,
    settings: settings ?? null,
    randomSeed: activeSession?.randomSeed ?? null,
    validationErrors: activeSession?.validationErrors ?? []
  };
}

export async function exportDebugSnapshotJson() {
  return JSON.stringify(await createDebugSnapshot(), null, 2);
}
