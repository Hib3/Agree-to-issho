import { dialogueTemplates } from "../../data/dialogue-templates/dialogueTemplates";
import { responsePatterns } from "../../data/response-patterns/responsePatterns";
import { planConversation } from "../../domain/conversation/planner";
import { applyResponse } from "../../domain/conversation/responseBranching";
import type {
  ConversationPhase,
  ConversationSession,
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
import type { ArticleDigest, ArticleFetchTrace, NewsItem, NewsResponseIntent } from "../../domain/model/news";
import { buildNewsConversationPlan } from "../../domain/news/newsExplanation";
import {
  applyNewsConversationResponse,
  createNewsConversationSession
} from "../../domain/news/newsConversationSession";

export async function startNewsConversation(input: {
  item: NewsItem;
  digest: ArticleDigest;
  fetchTrace: ArticleFetchTrace;
  now?: number;
}) {
  return withSingleFlight(`news-conversation-start:${input.item.id}`, () =>
    withExclusiveLock("conversation-start", () => startNewsConversationUnlocked(input))
  );
}

async function startNewsConversationUnlocked(input: {
  item: NewsItem;
  digest: ArticleDigest;
  fetchTrace: ArticleFetchTrace;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const [concepts, relations, memories, character, player, activeSessions] = await Promise.all([
    db.concepts.toArray(),
    db.relations.toArray(),
    db.memories.toArray(),
    db.character.get("aguri"),
    db.player.get("local"),
    db.conversationSessions.where("phase").notEqual("completed").sortBy("updatedAt")
  ]);
  if (!character || !player) throw new Error("部屋の情報を読み込めませんでした。");
  const active = activeSessions.at(-1);
  if (active?.origin?.type === "news" && active.origin.newsItemId === input.item.id) return active;
  if (active) throw new Error("今の会話を終えてから、ニュースを選んでください。");

  const plan = buildNewsConversationPlan(input.item, input.digest, concepts, {
    character,
    relations,
    memories,
    now
  });
  const session = createNewsConversationSession({
    item: input.item,
    digest: input.digest,
    plan,
    character,
    player,
    now,
    fetchTrace: input.fetchTrace
  });
  const errors = validateConversationSession(session);
  if (errors.length > 0) throw new Error(`ニュース会話を準備できませんでした (${errors.join(", ")})`);

  await db.transaction("rw", db.conversationSessions, db.newsItems, async () => {
    await db.conversationSessions.put(session);
    await db.newsItems.update(input.item.id, { discussionState: "discussing" });
  });
  return advanceConversationUnlocked(session.id, now, true);
}

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
    const migrated = isCurrentConversationSession(active) ? active : migrateConversationSession(active, now);
    const validationErrors = validateConversationSession(migrated);
    if (validationErrors.length === 0) {
      if (migrated !== active) await db.conversationSessions.put(migrated);
      return migrated;
    }
    await db.conversationSessions.put(migrateConversationSession(migrated, now, validationErrors));
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
  const storedSession = await db.conversationSessions.get(sessionId);
  if (!storedSession) throw new Error("会話を再開できませんでした。");
  const session = isCurrentConversationSession(storedSession)
    ? storedSession
    : migrateConversationSession(storedSession, now);
  const validationErrors = validateConversationSession(session);
  if (validationErrors.length > 0) {
    const recovered = migrateConversationSession(session, now, validationErrors);
    await db.conversationSessions.put(recovered);
    return recovered;
  }
  if (session !== storedSession) await db.conversationSessions.put(session);
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
  const completed = {
    ...session,
    phase: "completed" as const,
    completedAt: now,
    updatedAt: now,
    ...(session.origin.type === "news"
      ? {
          origin: {
            ...session.origin,
            discussionState: "discussed" as const,
            completedAt: now
          }
        }
      : {})
  };
  const memory = createMemory({
    type: "conversation",
    conceptIds: Object.values(session.slotConceptIds),
    locationId: session.locationId,
    importance: 0.55,
    now
  });
  await db.transaction("rw", db.conversationSessions, db.memories, db.character, db.newsItems, async () => {
    await db.conversationSessions.put(completed);
    await db.memories.put(memory);
    if (session.origin.type === "news") {
      await db.newsItems.update(session.origin.newsItemId, {
        discussionState: "discussed",
        discussedAt: now
      });
    }
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
  if (session.origin.type === "news") {
    if (!storedChoice.newsResponseIntent) throw new Error("ニュースへの返事を確認できませんでした。");
    const updated = applyNewsConversationResponse(session, storedChoice, now);
    const updatedCharacter = { ...character, lastUserInteractionAt: now, updatedAt: now };
    const memory = createMemory({
      type: "player_choice",
      conceptIds: session.origin.conceptIds,
      locationId: session.locationId,
      emotion: character.emotion,
      importance: 0.55,
      payload: newsReactionPayload(storedChoice.newsResponseIntent, session.origin.newsItemId),
      now
    });
    await db.transaction("rw", db.conversationSessions, db.character, db.memories, async () => {
      await db.conversationSessions.put(updated);
      await db.character.put(updatedCharacter);
      await db.memories.put(memory);
    });
    return advanceConversationUnlocked(updated.id, now, true);
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
  const closed = {
    ...sessionWithoutQuestion,
    ...(session.origin.type === "news"
      ? {
          origin: {
            ...session.origin,
            discussionState: "dismissed" as const,
            completedAt: now
          }
        }
      : {}),
    phase: "completed",
    questionIntent: "none",
    proposition: { ...session.proposition, questionIntent: "none" },
    queuedTurns: [],
    completedAt: now,
    updatedAt: now
  } satisfies ConversationSession;
  await db.transaction("rw", db.conversationSessions, db.newsItems, async () => {
    await db.conversationSessions.put(closed);
    if (session.origin.type === "news") {
      await db.newsItems.update(session.origin.newsItemId, { discussionState: "dismissed" });
    }
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
  const migrated = migrateConversationSession(session, now, errors);
  await db.transaction("rw", db.conversationSessions, db.newsItems, async () => {
    await db.conversationSessions.put(migrated);
    if (session.origin?.type === "news") {
      await db.newsItems.update(session.origin.newsItemId, { discussionState: "dismissed" });
    }
  });
}

function newsReactionPayload(intent: NewsResponseIntent, newsItemId: string) {
  const reactionType =
    intent === "correct_aguri"
      ? "correctionRequest"
      : intent === "personal_relevance"
        ? "userPreference"
        : ["interested", "not_interested", "ask_more"].includes(intent)
          ? "topicInterest"
          : "articleReaction";
  return {
    kind: reactionType,
    newsItemId,
    intent,
    temporaryReaction: true
  };
}
