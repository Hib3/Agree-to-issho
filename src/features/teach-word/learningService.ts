import type { ConceptCategory } from "../../domain/model/concept";
import { createUserConcept } from "../../domain/learning/conceptFactory";
import { findDuplicate } from "../../domain/learning/duplicateResolver";
import { createLearningSession, transitionLearning, type LearningContextId, type LearningSession } from "../../domain/learning/learningMachine";
import { createMemory } from "../../domain/memory/memoryService";
import { db } from "../../infrastructure/db/database";

export async function beginLearning(contextId: LearningContextId, now = Date.now()) {
  const existing = await db.learningSessions.get("active");
  if (existing && existing.state !== "completed") return existing;
  const session = createLearningSession(contextId, now);
  await db.learningSessions.put(session);
  return session;
}

export async function enterLearningText(session: LearningSession, value: string, now = Date.now()) {
  let next = transitionLearning(session, { type: "ENTER_TEXT", value }, now);
  next = transitionLearning(next, { type: "NORMALIZED" }, now);
  const concepts = await db.concepts.toArray();
  const duplicate = findDuplicate(next.normalizedInput, concepts);
  next = transitionLearning(next, duplicate ? { type: "DUPLICATE_FOUND", conceptId: duplicate.concept.id } : { type: "NO_DUPLICATE" }, now);
  await db.learningSessions.put(next);
  return next;
}

export async function chooseLearningCategory(session: LearningSession, category: ConceptCategory, now = Date.now()) {
  const next = transitionLearning(session, { type: "SELECT_CATEGORY", category }, now);
  await db.learningSessions.put(next);
  return next;
}

export async function setLearningAttributes(session: LearningSession, attributes: Record<string, string | number | boolean | null>, now = Date.now()) {
  const next = transitionLearning(session, { type: "SET_ATTRIBUTES", attributes }, now);
  await db.learningSessions.put(next);
  return next;
}

export async function setLearningPreference(session: LearningSession, preference: -2 | -1 | 0 | 1 | 2, now = Date.now()) {
  const next = transitionLearning(session, { type: "SET_PREFERENCE", preference }, now);
  await db.learningSessions.put(next);
  return next;
}

export async function commitLearning(session: LearningSession, now = Date.now()) {
  if (!session.selectedCategory) throw new Error("言葉の種類が選ばれていません。");
  const confirmed = transitionLearning(session, { type: "CONFIRM" }, now);
  const category = confirmed.selectedCategory;
  if (!category) throw new Error("言葉の種類が失われました。");
  const attributes = { ...confirmed.attributes };
  if (["famous_person", "person_name", "occupation", "person_descriptor"].includes(category)) {
    attributes.displayName = confirmed.normalizedInput;
  }
  const concept = createUserConcept({ surface: confirmed.normalizedInput, category, ...(confirmed.preference !== undefined ? { preference: confirmed.preference } : {}), attributes }, now);
  const memory = createMemory({ type: "word_learned", conceptIds: [concept.id], locationId: "room", emotion: "excited", importance: 0.8, now });
  let completed = transitionLearning(confirmed, { type: "COMMITTED" }, now);
  completed = transitionLearning(completed, { type: "CELEBRATED" }, now);
  await db.transaction("rw", db.concepts, db.memories, db.learningSessions, async () => {
    await db.concepts.put(concept);
    await db.memories.put(memory);
    await db.learningSessions.put(completed);
  });
  return concept;
}

export async function cancelLearning() {
  await db.learningSessions.delete("active");
}
