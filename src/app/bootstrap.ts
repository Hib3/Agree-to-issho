import { starterConcepts } from "../data/starter/starterConcepts";
import { db } from "../infrastructure/db/database";
import type { CharacterState } from "../domain/model/character";
import { createDefaultSettings, migrateGameSettings } from "../domain/settings/gameSettings";

export async function bootstrapApp(now = Date.now()) {
  await db.open();
  const starterCount = await db.concepts.where("source").equals("starter").count();
  if (starterCount < starterConcepts.length) await db.concepts.bulkPut(starterConcepts);
  const character = await db.character.get("aguri");
  if (!character) await db.character.put(defaultCharacter(now));
  const settings = await db.settings.get("local");
  if (!settings) {
    await db.settings.put(createDefaultSettings(now));
  } else {
    const migrated = migrateGameSettings(settings, now);
    if (JSON.stringify(migrated) !== JSON.stringify(settings)) await db.settings.put(migrated);
  }
  return loadSnapshot();
}

export async function loadSnapshot() {
  const [
    player,
    character,
    settings,
    concepts,
    relations,
    memories,
    sessions,
    dialogue,
    diaries,
    learningSession,
    newsItems
  ] = await Promise.all([
    db.player.get("local"),
    db.character.get("aguri"),
    db.settings.get("local"),
    db.concepts.toArray(),
    db.relations.toArray(),
    db.memories.toArray(),
    db.conversationSessions.orderBy("updatedAt").toArray(),
    db.dialogueHistory.orderBy("createdAt").toArray(),
    db.diaries.orderBy("date").toArray(),
    db.learningSessions.get("active"),
    db.newsItems.orderBy("publishedAt").reverse().limit(120).toArray()
  ]);
  return {
    player: player ?? null,
    character: character ?? null,
    settings: settings ?? null,
    concepts,
    relations,
    memories,
    sessions,
    dialogue,
    diaries,
    learningSession: learningSession ?? null,
    newsItems
  };
}

export async function resetGameData(now = Date.now()) {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
  return bootstrapApp(now);
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
