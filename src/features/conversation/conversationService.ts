import { dialogueTemplates } from "../../data/dialogue-templates/dialogueTemplates";
import { responsePatterns } from "../../data/response-patterns/responsePatterns";
import { planConversation } from "../../domain/conversation/planner";
import { applyResponse } from "../../domain/conversation/responseBranching";
import type {
  ConversationPhase,
  DialogueChoice,
  DialogueHistoryEntry
} from "../../domain/model/conversation";
import { createMemory } from "../../domain/memory/memoryService";
import { SeededRandom } from "../../infrastructure/random/random";
import { db } from "../../infrastructure/db/database";
import { buildIntentBias } from "../../domain/conversation/intentPolicy";
import { locations } from "../../data/locations/locations";
import {
  isCurrentConversationSession,
  migrateConversationSession
} from "../../domain/conversation/sessionMigration";
import { validateConversationSession } from "../../domain/conversation/dialogueValidator";
import { withExclusiveLock, withSingleFlight } from "../../infrastructure/concurrency/exclusiveLock";

export async function startConversation(now = Date.now(), initiatedByUser = true) {
  return withSingleFlight("conversation-start-flight", () =>
    withExclusiveLock("conversation-start", () => startConversationUnlocked(now, initiatedByUser))
  );
}

async function startConversationUnlocked(now: number, initiatedByUser: boolean) {
  const [concepts, relations, activeSessions, newestCompletedSessions, character] = await Promise.all([
    db.concepts.toArray(),
    db.relations.toArray(),
    db.conversationSessions.where("phase").notEqual("completed").sortBy("updatedAt"),
    db.conversationSessions
      .orderBy("updatedAt")
      .reverse()
      .filter((session) => session.phase === "completed")
      .limit(24)
      .toArray(),
    db.character.get("aguri")
  ]);
  if (!character) throw new Error("アグリちゃんの状態を読み込めません。");
  const active = activeSessions.at(-1);
  if (active) {
    const validationErrors = isCurrentConversationSession(active)
      ? validateConversationSession(active)
      : ["legacy_session"];
    if (validationErrors.length === 0) return active;
    await db.conversationSessions.put(migrateConversationSession(active, now, validationErrors));
  }
  const completedSessions = newestCompletedSessions.reverse();
  const location = locations.find((item) => item.id === character.currentLocationId) ?? locations[0]!;
  const randomSeed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  const session = planConversation({
    templates: dialogueTemplates,
    responsePatterns,
    concepts,
    relations,
    recentSessions: completedSessions,
    character,
    locationId: character.currentLocationId,
    now,
    random: new SeededRandom(randomSeed),
    randomSeed,
    intentBias: buildIntentBias({ concepts, recentSessions: completedSessions, character, location, now })
  });
  await db.conversationSessions.put(session);
  return advanceConversationUnlocked(session.id, now, initiatedByUser);
}

export async function advanceConversation(sessionId: string, now = Date.now(), initiatedByUser = true) {
  return withSingleFlight(`conversation-advance-flight:${sessionId}`, () =>
    withExclusiveLock(`conversation:${sessionId}`, () =>
      advanceConversationUnlocked(sessionId, now, initiatedByUser)
    )
  );
}

async function advanceConversationUnlocked(sessionId: string, now: number, initiatedByUser: boolean) {
  const session = await db.conversationSessions.get(sessionId);
  if (!session) throw new Error("会話を再開できませんでした。");
  const validationErrors = isCurrentConversationSession(session)
    ? validateConversationSession(session)
    : ["legacy_session"];
  if (validationErrors.length > 0) {
    const recovered = migrateConversationSession(session, now, validationErrors);
    await db.conversationSessions.put(recovered);
    return recovered;
  }
  if (session.phase === "awaiting_answer") return session;
  const [next, ...remaining] = session.queuedTurns;
  if (next) {
    const history = [...session.history, next];
    // The last spoken page must remain visible before the question replaces it.
    const phase: ConversationPhase = remaining.length === 0 ? "closing" : "premise";
    const updated = { ...session, phase, history, queuedTurns: remaining, updatedAt: now };
    const historyEntry: DialogueHistoryEntry = {
      ...next,
      sessionId: session.id,
      intent: session.intent,
      locationId: session.locationId
    };
    await db.transaction(
      "rw",
      db.conversationSessions,
      db.dialogueHistory,
      db.concepts,
      db.character,
      async () => {
        await db.conversationSessions.put(updated);
        await db.dialogueHistory.put(historyEntry);
        for (const conceptId of next.conceptIds) {
          const concept = await db.concepts.get(conceptId);
          if (concept)
            await db.concepts.put({ ...concept, usageCount: concept.usageCount + 1, lastUsedAt: now });
        }
        const character = await db.character.get("aguri");
        if (character)
          await db.character.put({
            ...character,
            emotion: next.emotion,
            lastSpeechAt: now,
            ...(initiatedByUser ? { lastUserInteractionAt: now } : {}),
            updatedAt: now
          });
      }
    );
    return updated;
  }
  if (session.pendingQuestion) {
    const updated = { ...session, phase: "awaiting_answer" as const, updatedAt: now };
    await db.conversationSessions.put(updated);
    return updated;
  }
  const completed = { ...session, phase: "completed" as const, completedAt: now, updatedAt: now };
  const memory = createMemory({
    type: "conversation",
    conceptIds: Object.values(session.slotConceptIds),
    locationId: session.locationId,
    importance: 0.55,
    now
  });
  await db.transaction("rw", db.conversationSessions, db.memories, db.character, async () => {
    await db.conversationSessions.put(completed);
    await db.memories.put(memory);
    if (initiatedByUser) {
      const character = await db.character.get("aguri");
      if (character) await db.character.put({ ...character, lastUserInteractionAt: now, updatedAt: now });
    }
  });
  return completed;
}

export async function answerConversation(sessionId: string, choice: DialogueChoice, now = Date.now()) {
  return withExclusiveLock(`conversation:${sessionId}`, () =>
    answerConversationUnlocked(sessionId, choice, now)
  );
}

async function answerConversationUnlocked(sessionId: string, choice: DialogueChoice, now: number) {
  const [session, character, relations, concepts] = await Promise.all([
    db.conversationSessions.get(sessionId),
    db.character.get("aguri"),
    db.relations.toArray(),
    db.concepts.toArray()
  ]);
  if (!session || !character) throw new Error("この質問には今は答えられません。");
  // A repeated submit must not apply semantic effects twice.
  if (session.phase !== "awaiting_answer") return session;
  const storedChoice = session.pendingQuestion?.answerSchema.find((option) => option.id === choice.id);
  if (!storedChoice) {
    throw new Error("この質問の選択肢ではありません。");
  }
  const result = applyResponse(session, storedChoice, character, relations, concepts, now);
  const updatedCharacter = { ...result.character, lastUserInteractionAt: now };
  const answerConceptIds = result.session.queuedTurns.at(-1)?.conceptIds ?? session.topicWordIds;
  const memory = result.shouldRecordMemory
    ? createMemory({
        type: "player_choice",
        conceptIds: answerConceptIds,
        locationId: session.locationId,
        emotion: updatedCharacter.emotion,
        importance: 0.7,
        payload: {
          choiceId: storedChoice.id,
          effect: storedChoice.effect,
          answerEffect: result.answer,
          questionIntent: session.questionIntent
        },
        now
      })
    : null;
  await db.transaction(
    "rw",
    db.conversationSessions,
    db.character,
    db.relations,
    db.concepts,
    db.memories,
    async () => {
      await db.conversationSessions.put(result.session);
      await db.character.put(updatedCharacter);
      await db.relations.bulkPut(result.relations);
      await db.concepts.bulkPut(result.concepts);
      if (memory) await db.memories.put(memory);
    }
  );
  // A submitted answer is itself an advance action, so show Aguri's reaction immediately.
  return advanceConversationUnlocked(result.session.id, now, true);
}

export async function closeConversation(sessionId: string, now = Date.now()) {
  return withExclusiveLock(`conversation:${sessionId}`, () => closeConversationUnlocked(sessionId, now));
}

async function closeConversationUnlocked(sessionId: string, now: number) {
  const session = await db.conversationSessions.get(sessionId);
  if (!session) return;
  const { pendingQuestion, ...sessionWithoutQuestion } = session;
  void pendingQuestion;
  await db.conversationSessions.put({
    ...sessionWithoutQuestion,
    phase: "completed",
    questionIntent: "none",
    proposition: { ...session.proposition, questionIntent: "none" },
    queuedTurns: [],
    completedAt: now,
    updatedAt: now
  });
}

export async function invalidateConversationSession(sessionId: string, errors: string[], now = Date.now()) {
  return withExclusiveLock(`conversation:${sessionId}`, () =>
    invalidateConversationSessionUnlocked(sessionId, errors, now)
  );
}

async function invalidateConversationSessionUnlocked(sessionId: string, errors: string[], now: number) {
  const session = await db.conversationSessions.get(sessionId);
  if (!session) return;
  await db.conversationSessions.put(migrateConversationSession(session, now, errors));
}
