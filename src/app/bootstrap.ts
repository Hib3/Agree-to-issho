import { starterConcepts } from "../data/starter/starterConcepts";
import { db } from "../infrastructure/db/database";
import type { CharacterState } from "../domain/model/character";
import type { GameSettings } from "../domain/model/player";

export async function bootstrapApp(now = Date.now()) {
  await db.open();
  const starterCount = await db.concepts.where("source").equals("starter").count();
  if (starterCount < starterConcepts.length) await db.concepts.bulkPut(starterConcepts);
  const character = await db.character.get("aguri");
  if (!character) await db.character.put(defaultCharacter(now));
  const settings = await db.settings.get("local");
  if (!settings) await db.settings.put(defaultSettings(now));
  return loadSnapshot();
}

export async function loadSnapshot() {
  const [player, character, settings, concepts, relations, memories, sessions, dialogue, diaries, learningSession] =
    await Promise.all([
      db.player.get("local"),
      db.character.get("aguri"),
      db.settings.get("local"),
      db.concepts.toArray(),
      db.relations.toArray(),
      db.memories.toArray(),
      db.conversationSessions.orderBy("updatedAt").toArray(),
      db.dialogueHistory.orderBy("createdAt").toArray(),
      db.diaries.orderBy("date").toArray(),
      db.learningSessions.get("active")
    ]);
  return { player: player ?? null, character: character ?? null, settings: settings ?? null, concepts, relations, memories, sessions, dialogue, diaries, learningSession: learningSession ?? null };
}

function defaultCharacter(now: number): CharacterState {
  return {
    id: "aguri",
    name: "アグリちゃん",
    emotion: "curious",
    energy: 82,
    closeness: 10,
    curiosity: 0.8,
    socialNeed: 20,
    trust: 20,
    boredom: 0,
    currentLocationId: "room",
    lastUserInteractionAt: now,
    lastSpeechAt: now,
    updatedAt: now
  };
}

function defaultSettings(now: number): GameSettings {
  return { id: "local", textSpeed: "normal", fontScale: "normal", highContrast: false, reducedMotion: false, volume: 0.7, muted: true, autonomousSpeech: true, updatedAt: now };
}
