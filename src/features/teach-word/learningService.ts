import type { ConceptAttributeValue, ConceptAttributes, ConceptCategory } from "../../domain/model/concept";
import type { LocationId } from "../../domain/model/location";
import { createUserConcept } from "../../domain/learning/conceptFactory";
import { findDuplicate } from "../../domain/learning/duplicateResolver";
import {
  createLearningSession,
  transitionLearning,
  type LearningContextId,
  type LearningSession
} from "../../domain/learning/learningMachine";
import { createMemory } from "../../domain/memory/memoryService";
import { db } from "../../infrastructure/db/database";
import { withExclusiveLock, withSingleFlight } from "../../infrastructure/concurrency/exclusiveLock";

export async function beginLearning(
  contextId: LearningContextId,
  locationId: LocationId = "room",
  now = Date.now()
) {
  return withSingleFlight("learning-begin-flight", () =>
    withExclusiveLock("learning-active", async () => {
      const existing = await db.learningSessions.get("active");
      if (existing && existing.state !== "completed") return existing;
      const session = createLearningSession(contextId, now, locationId);
      await db.learningSessions.put(session);
      return session;
    })
  );
}

export async function enterLearningText(session: LearningSession, value: string, now = Date.now()) {
  let next = transitionLearning(session, { type: "ENTER_TEXT", value }, now);
  next = transitionLearning(next, { type: "NORMALIZED" }, now);
  const concepts = await db.concepts.toArray();
  const duplicate = findDuplicate(next.normalizedInput, concepts);
  next = transitionLearning(
    next,
    duplicate ? { type: "DUPLICATE_FOUND", conceptId: duplicate.concept.id } : { type: "NO_DUPLICATE" },
    now
  );
  await db.learningSessions.put(next);
  return next;
}

export async function chooseLearningCategory(
  session: LearningSession,
  category: ConceptCategory,
  now = Date.now()
) {
  const next = transitionLearning(session, { type: "SELECT_CATEGORY", category }, now);
  await db.learningSessions.put(next);
  return next;
}

export async function answerLearningAttribute(
  session: LearningSession,
  key: string,
  value: ConceptAttributeValue,
  isLast: boolean,
  now = Date.now()
) {
  const next = transitionLearning(session, { type: "ANSWER_ATTRIBUTE", key, value, isLast }, now);
  await db.learningSessions.put(next);
  return next;
}

export async function completeLearningAttributes(session: LearningSession, now = Date.now()) {
  const next = transitionLearning(session, { type: "SKIP_ATTRIBUTES" }, now);
  await db.learningSessions.put(next);
  return next;
}

export async function setLearningAttributes(
  session: LearningSession,
  attributes: ConceptAttributes,
  now = Date.now()
) {
  const next = transitionLearning(session, { type: "SET_ATTRIBUTES", attributes }, now);
  await db.learningSessions.put(next);
  return next;
}

export async function setLearningReading(session: LearningSession, reading: string, now = Date.now()) {
  const next = transitionLearning(session, { type: "SET_READING", reading }, now);
  await db.learningSessions.put(next);
  return next;
}

export async function setLearningPreference(
  session: LearningSession,
  preference: -2 | -1 | 0 | 1 | 2,
  now = Date.now()
) {
  const next = transitionLearning(session, { type: "SET_PREFERENCE", preference }, now);
  await db.learningSessions.put(next);
  return next;
}

export async function commitLearning(session: LearningSession, now = Date.now()) {
  return withSingleFlight("learning-commit-flight", () =>
    withExclusiveLock("learning-active", () => commitLearningUnlocked(session, now))
  );
}

async function commitLearningUnlocked(session: LearningSession, now: number) {
  const stored = await db.learningSessions.get("active");
  if (stored?.committedConceptId) {
    const committed = await db.concepts.get(stored.committedConceptId);
    if (committed) return committed;
  }
  const authoritative = stored && stored.state !== "completed" ? stored : session;
  if (!authoritative.selectedCategory) throw new Error("言葉の種類が選ばれていません。");
  const confirmed = transitionLearning(authoritative, { type: "CONFIRM" }, now);
  const category = confirmed.selectedCategory;
  if (!category) throw new Error("言葉の種類が失われました。");
  const attributes = { ...confirmed.attributes };
  if (["famous_person", "person_name", "occupation", "person_descriptor"].includes(category)) {
    attributes.displayName = confirmed.normalizedInput;
  }
  const concept = createUserConcept(
    {
      surface: confirmed.normalizedInput,
      category,
      ...(confirmed.preference !== undefined ? { preference: confirmed.preference } : {}),
      ...(confirmed.reading ? { reading: confirmed.reading } : {}),
      attributes
    },
    now
  );
  const memory = createMemory({
    type: "word_learned",
    conceptIds: [concept.id],
    locationId: confirmed.locationId ?? "room",
    emotion: "excited",
    importance: 0.8,
    now
  });
  let completed = transitionLearning(confirmed, { type: "COMMITTED" }, now);
  completed = transitionLearning(completed, { type: "CELEBRATED" }, now);
  completed = { ...completed, committedConceptId: concept.id };
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
