import { db } from "../database";
import type { CharacterState } from "../../../domain/model/character";
import type { Concept } from "../../../domain/model/concept";
import type { ConversationSession, DialogueHistoryEntry } from "../../../domain/model/conversation";
import type { DiaryEntry, MemoryEvent } from "../../../domain/model/memory";
import type { GameSettings, PlayerProfile } from "../../../domain/model/player";
import type { ConceptRelation } from "../../../domain/model/relation";
import type { LearningSession } from "../../../domain/learning/learningMachine";

export const gameRepository = {
  getPlayer: () => db.player.get("local"),
  savePlayer: (player: PlayerProfile) => db.player.put(player),
  getCharacter: () => db.character.get("aguri"),
  saveCharacter: (character: CharacterState) => db.character.put(character),
  getSettings: () => db.settings.get("local"),
  saveSettings: (settings: GameSettings) => db.settings.put(settings),
  listConcepts: () => db.concepts.toArray(),
  saveConcept: (concept: Concept) => db.concepts.put(concept),
  saveConcepts: (concepts: Concept[]) => db.concepts.bulkPut(concepts),
  listRelations: () => db.relations.toArray(),
  saveRelations: (relations: ConceptRelation[]) => db.relations.bulkPut(relations),
  listMemories: () => db.memories.toArray(),
  saveMemory: (memory: MemoryEvent) => db.memories.put(memory),
  listSessions: () => db.conversationSessions.orderBy("updatedAt").toArray(),
  getActiveSession: () => db.conversationSessions.filter((session) => session.phase !== "completed").last(),
  saveSession: (session: ConversationSession) => db.conversationSessions.put(session),
  listDialogue: () => db.dialogueHistory.orderBy("createdAt").toArray(),
  saveDialogue: (turns: DialogueHistoryEntry[]) => db.dialogueHistory.bulkPut(turns),
  listDiaries: () => db.diaries.orderBy("date").toArray(),
  saveDiary: (diary: DiaryEntry) => db.diaries.put(diary),
  getLearningSession: () => db.learningSessions.get("active"),
  saveLearningSession: (session: LearningSession) => db.learningSessions.put(session),
  clearLearningSession: () => db.learningSessions.delete("active")
};
