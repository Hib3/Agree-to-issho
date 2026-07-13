import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrapApp } from "../app/bootstrap";
import { startConversation } from "../features/conversation/conversationService";
import {
  beginLearning,
  chooseLearningCategory,
  commitLearning,
  completeLearningAttributes,
  enterLearningText,
  setLearningPreference
} from "../features/teach-word/learningService";
import { db } from "../infrastructure/db/database";

const now = 1_700_000_000_000;

beforeEach(async () => {
  db.close();
  await db.delete();
  await bootstrapApp(now);
});

afterEach(async () => {
  db.close();
  await db.delete();
});

describe("idempotent game operations", () => {
  it("coalesces StrictMode-style simultaneous conversation starts", async () => {
    const [first, second] = await Promise.all([
      startConversation(now + 1, true),
      startConversation(now + 1, true)
    ]);
    expect(first.id).toBe(second.id);
    expect(await db.conversationSessions.where("phase").notEqual("completed").count()).toBe(1);
  });

  it("commits one concept and one memory when learning is submitted twice", async () => {
    const started = await beginLearning("room_object", "room", now + 1);
    const entered = await enterLearningText(started, "夜空のパン", now + 2);
    const categorized = await chooseLearningCategory(entered, "food_drink", now + 3);
    const attributesDone = await completeLearningAttributes(categorized, now + 4);
    const ready = await setLearningPreference(attributesDone, 1, now + 5);
    const [first, second] = await Promise.all([
      commitLearning(ready, now + 6),
      commitLearning(ready, now + 6)
    ]);
    expect(first.id).toBe(second.id);
    expect(await db.concepts.where("source").equals("user").count()).toBe(1);
    expect(await db.memories.where("type").equals("word_learned").count()).toBe(1);
    expect((await db.learningSessions.get("active"))?.committedConceptId).toBe(first.id);
  });
});
