import { dialogueTemplates } from "../../data/dialogue-templates/dialogueTemplates";
import { responsePatterns } from "../../data/response-patterns/responsePatterns";
import { planConversation } from "../../domain/conversation/planner";
import { applyResponse } from "../../domain/conversation/responseBranching";
import type { ConversationPhase, DialogueChoice, DialogueHistoryEntry } from "../../domain/model/conversation";
import { createMemory } from "../../domain/memory/memoryService";
import { systemRandom } from "../../infrastructure/random/random";
import { db } from "../../infrastructure/db/database";
import { buildIntentBias } from "../../domain/conversation/intentPolicy";
import { locations } from "../../data/locations/locations";

export async function startConversation(now = Date.now(), initiatedByUser = true) {
  const [concepts, relations, recentSessions, character] = await Promise.all([
    db.concepts.toArray(),
    db.relations.toArray(),
    db.conversationSessions.where("phase").notEqual("completed").toArray().then(async (active) => {
      if (active.length > 0) return db.conversationSessions.orderBy("updatedAt").reverse().limit(24).toArray();
      return db.conversationSessions.orderBy("updatedAt").reverse().limit(24).toArray();
    }),
    db.character.get("aguri")
  ]);
  if (!character) throw new Error("アグリちゃんの状態を読み込めません。");
  const active = recentSessions.find((session) => session.phase !== "completed");
  if (active) return active;
  const completedSessions = recentSessions.filter((item) => item.phase === "completed");
  const location = locations.find((item) => item.id === character.currentLocationId) ?? locations[0]!;
  const session = planConversation({
    templates: dialogueTemplates,
    responsePatterns,
    concepts,
    relations,
    recentSessions: completedSessions,
    character,
    locationId: character.currentLocationId,
    now,
    random: systemRandom,
    intentBias: buildIntentBias({ concepts, recentSessions: completedSessions, character, location, now })
  });
  await db.conversationSessions.put(session);
  return advanceConversation(session.id, now, initiatedByUser);
}

export async function advanceConversation(sessionId: string, now = Date.now(), initiatedByUser = true) {
  const session = await db.conversationSessions.get(sessionId);
  if (!session) throw new Error("会話を再開できませんでした。");
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
    await db.transaction("rw", db.conversationSessions, db.dialogueHistory, db.concepts, db.character, async () => {
      await db.conversationSessions.put(updated);
      await db.dialogueHistory.put(historyEntry);
      for (const conceptId of next.conceptIds) {
        const concept = await db.concepts.get(conceptId);
        if (concept) await db.concepts.put({ ...concept, usageCount: concept.usageCount + 1, lastUsedAt: now });
      }
      const character = await db.character.get("aguri");
      if (character) await db.character.put({
        ...character,
        emotion: next.emotion,
        lastSpeechAt: now,
        ...(initiatedByUser ? { lastUserInteractionAt: now } : {}),
        updatedAt: now
      });
    });
    return updated;
  }
  if (session.pendingQuestion) {
    const updated = { ...session, phase: "awaiting_answer" as const, updatedAt: now };
    await db.conversationSessions.put(updated);
    return updated;
  }
  const completed = { ...session, phase: "completed" as const, completedAt: now, updatedAt: now };
  const memory = createMemory({ type: "conversation", conceptIds: Object.values(session.slotConceptIds), locationId: session.locationId, importance: 0.55, now });
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
  const [session, character, relations, concepts] = await Promise.all([
    db.conversationSessions.get(sessionId),
    db.character.get("aguri"),
    db.relations.toArray(),
    db.concepts.toArray()
  ]);
  if (!session || !character || session.phase !== "awaiting_answer") throw new Error("この質問には今は答えられません。");
  const result = applyResponse(session, choice, character, relations, concepts, now);
  const updatedCharacter = { ...result.character, lastUserInteractionAt: now };
  const memory = createMemory({
    type: "player_choice",
    conceptIds: Object.values(session.slotConceptIds),
    locationId: session.locationId,
    emotion: updatedCharacter.emotion,
    importance: 0.7,
    payload: { choiceId: choice.id, effect: choice.effect },
    now
  });
  await db.transaction("rw", db.conversationSessions, db.character, db.relations, db.concepts, db.memories, async () => {
    await db.conversationSessions.put(result.session);
    await db.character.put(updatedCharacter);
    await db.relations.bulkPut(result.relations);
    await db.concepts.bulkPut(result.concepts);
    await db.memories.put(memory);
  });
  // A submitted answer is itself an advance action, so show Aguri's reaction immediately.
  return advanceConversation(result.session.id, now, true);
}
