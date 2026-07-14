import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CharacterState } from "../domain/model/character";
import type { ConversationSession } from "../domain/model/conversation";
import type { ArticleDigest, ArticleFetchTrace, NewsItem } from "../domain/model/news";
import type { NewsResponseIntent } from "../domain/model/news";
import type { PlayerProfile } from "../domain/model/player";
import { validateConversationSession } from "../domain/conversation/dialogueValidator";
import { migrateConversationSession } from "../domain/conversation/sessionMigration";
import { buildNewsConversationPlan } from "../domain/news/newsExplanation";
import {
  applyNewsConversationResponse,
  createNewsConversationSession
} from "../domain/news/newsConversationSession";
import {
  advanceConversation,
  answerConversation,
  startNewsConversation
} from "../features/conversation/conversationService";
import { db } from "../infrastructure/db/database";

const now = 1_720_000_000_000;
const item: NewsItem = {
  id: "news_session_item",
  feedId: "feed_session",
  sourceName: "交通だより",
  title: "三つの駅で新しい案内を試験",
  summary: "交通局が三つの駅で案内表示を試験すると発表した。",
  url: "https://example.com/news/session",
  publishedAt: now - 1000,
  fetchedAt: now,
  discussionState: "unread"
};
const digest: ArticleDigest = {
  newsItemId: item.id,
  contentLevel: "article_extract",
  sourceUrl: item.url,
  extractedAt: now,
  keyFacts: [
    { id: "fact_trial", text: "交通局は三つの駅で案内表示を試験する。", evidenceId: "evidence_1" },
    { id: "fact_record", text: "利用者の反応を三か月記録する。", evidenceId: "evidence_2" }
  ],
  keySentences: [
    { id: `${item.id}_headline`, text: item.title, source: "headline" },
    { id: "evidence_1", text: "交通局は三つの駅で案内表示を試験する。", source: "article" },
    { id: "evidence_2", text: "利用者の反応を三か月記録する。", source: "article" }
  ],
  entities: [{ name: "交通局", kind: "organization" }],
  topics: [{ key: "transport", label: "交通" }],
  events: [{ id: "event_1", description: "案内表示の試験", evidenceId: "evidence_1" }],
  numericalFacts: [{ value: "三つの駅", context: "三つの駅で試験する。", evidenceId: "evidence_1" }],
  issues: [
    {
      id: "issue_change",
      label: "起きる変化",
      summary: "交通局は三つの駅で案内表示を試験する。",
      evidenceIds: ["fact_trial", "evidence_1"],
      kind: "change",
      importance: 0.9,
      relevanceToUser: 0.7,
      suitabilityForOpinion: 0.8
    },
    {
      id: "issue_record",
      label: "利用記録",
      summary: "利用者の反応を三か月記録する。",
      evidenceIds: ["fact_record", "evidence_2"],
      kind: "risk",
      importance: 0.75,
      relevanceToUser: 0.8,
      suitabilityForOpinion: 0.85
    }
  ],
  uncertainties: ["試験後の正式導入は不明です。"],
  tone: "neutral",
  confidence: 0.78
};
const trace: ArticleFetchTrace = {
  articleUrl: item.url,
  startedAt: now,
  attempts: [
    {
      method: "direct_article",
      startedAt: now,
      finishedAt: now + 1,
      result: "success",
      statusCode: 200,
      contentType: "text/html",
      extractedCharacters: 180
    }
  ],
  finalContentLevel: "article_extract"
};
const character: CharacterState = {
  id: "aguri",
  name: "アグリちゃん",
  emotion: "curious",
  energy: 70,
  closeness: 50,
  curiosity: 0.8,
  socialNeed: 40,
  trust: 55,
  boredom: 20,
  currentLocationId: "room",
  lastUserInteractionAt: now - 1000,
  lastSpeechAt: now - 1000,
  updatedAt: now
};
const player: PlayerProfile = {
  id: "local",
  name: "ひびき",
  callName: "ひびきさん",
  createdAt: now,
  updatedAt: now
};

function makeSession() {
  const plan = buildNewsConversationPlan(item, digest, [], { character, now });
  return createNewsConversationSession({ item, digest, plan, character, player, now, fetchTrace: trace });
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe("news conversation session", () => {
  it("converts a grounded plan into a valid ordinary ConversationSession shape", () => {
    const session = makeSession();
    expect(session.origin.type).toBe("news");
    expect(session.pendingQuestion?.choices.length).toBeGreaterThanOrEqual(3);
    expect(session.queuedTurns.length).toBeGreaterThan(2);
    expect(validateConversationSession(session)).toEqual([]);
    if (session.origin.type === "news") {
      expect(session.origin.selectedIssueIds).toEqual(["issue_change", "issue_record"]);
      expect(session.origin.articleDigest.keySentences.every((entry) => entry.text.length <= 320)).toBe(true);
    }
  });

  it("branches user reactions and revises Aguri's opinion without overwriting the user", () => {
    const session = { ...makeSession(), phase: "awaiting_answer" as const };
    const agreeChoice = session.pendingQuestion!.choices.find(
      (choice) => choice.newsResponseIntent === "agree"
    )!;
    const disagreeChoice = session.pendingQuestion!.choices.find(
      (choice) => choice.newsResponseIntent === "disagree"
    )!;
    const agreed = applyNewsConversationResponse(session, agreeChoice, now + 10);
    const disagreed = applyNewsConversationResponse(session, disagreeChoice, now + 11);
    expect(agreed.queuedTurns[0]?.page).not.toBe(disagreed.queuedTurns[0]?.page);
    expect(agreed.origin.type).toBe("news");
    expect(disagreed.origin.type).toBe("news");
    if (agreed.origin.type === "news" && disagreed.origin.type === "news") {
      expect(agreed.origin.evolvingOpinion.revisionReason).toBe("user_agreement");
      expect(disagreed.origin.evolvingOpinion.revisionReason).toBe("user_disagreement");
      expect(disagreed.origin.evolvingOpinion.revisedOpinion?.owner).toBe("aguri");
      expect(disagreed.origin.evolvingOpinion.initialOpinion.owner).toBe("aguri");
      expect(disagreed.origin.userReaction?.intent).toBe("disagree");
    }
  });

  it.each<NewsResponseIntent>([
    "agree",
    "disagree",
    "interested",
    "not_interested",
    "concerned",
    "surprised",
    "personal_relevance",
    "correct_aguri",
    "ask_more",
    "close_topic"
  ])("records the %s response as a reaction rather than an article fact", (intent) => {
    const session = { ...makeSession(), phase: "awaiting_answer" as const };
    const choice = {
      ...session.pendingQuestion!.choices[0]!,
      id: `choice_${intent}`,
      newsResponseIntent: intent
    };
    const updated = applyNewsConversationResponse(session, choice, now + 20);
    expect(updated.queuedTurns[0]?.page.trim().length).toBeGreaterThan(10);
    if (updated.origin.type !== "news") throw new Error("news origin expected");
    if (session.origin.type !== "news") throw new Error("news origin expected");
    expect(updated.origin.userReaction?.intent).toBe(intent);
    expect(updated.origin.articleDigest).toEqual(session.origin.articleDigest);
  });

  it("keeps headline-only conversation explicit about not reading the body", () => {
    const headlineDigest: ArticleDigest = {
      ...digest,
      contentLevel: "headline_only",
      keyFacts: [],
      keySentences: [{ id: `${item.id}_headline`, text: item.title, source: "headline" }],
      issues: [],
      numericalFacts: [],
      confidence: 0.25
    };
    const headlineTrace: ArticleFetchTrace = { ...trace, finalContentLevel: "headline_only" };
    const plan = buildNewsConversationPlan(item, headlineDigest, [], { character, now });
    const session = createNewsConversationSession({
      item,
      digest: headlineDigest,
      plan,
      character,
      player,
      now,
      fetchTrace: headlineTrace
    });
    expect(session.queuedTurns.map((turn) => turn.page).join(" ")).toContain("見出し");
    expect(session.queuedTurns.map((turn) => turn.page).join(" ")).toContain("不明");
    expect(session.pendingQuestion?.choices.some((choice) => choice.label === "見出しだけでも話す")).toBe(
      true
    );
  });

  it("migrates revision 4 sessions in place and defaults the origin to ordinary", () => {
    const current = makeSession();
    const legacy = {
      ...current,
      dialogueRevision: 4,
      origin: undefined
    } as unknown as ConversationSession;
    const migrated = migrateConversationSession(legacy, now + 50);
    expect(migrated.dialogueRevision).toBe(5);
    expect(migrated.origin).toEqual({ type: "ordinary" });
    expect(migrated.phase).toBe(current.phase);
    expect(migrated.queuedTurns).toHaveLength(current.queuedTurns.length);
  });

  it("sets discussedAt only after the response and final page complete", async () => {
    await db.player.put(player);
    await db.character.put(character);
    await db.newsItems.put(item);
    let session = await startNewsConversation({ item, digest, fetchTrace: trace, now });
    expect((await db.newsItems.get(item.id))?.discussedAt).toBeUndefined();
    while (session.phase !== "awaiting_answer") {
      session = await advanceConversation(session.id, session.updatedAt + 1);
    }
    expect((await db.newsItems.get(item.id))?.discussedAt).toBeUndefined();
    const choice = session.pendingQuestion!.choices.find((entry) => entry.newsResponseIntent === "disagree")!;
    session = await answerConversation(session.id, choice, session.updatedAt + 1);
    expect((await db.newsItems.get(item.id))?.discussedAt).toBeUndefined();
    session = await advanceConversation(session.id, session.updatedAt + 1);
    const storedItem = await db.newsItems.get(item.id);
    expect(session.phase).toBe("completed");
    expect(storedItem?.discussionState).toBe("discussed");
    expect(storedItem?.discussedAt).toBeTypeOf("number");
    const storedRelations = await db.relations.toArray();
    expect(storedRelations).toEqual([]);
    const reaction = (await db.memories.where("type").equals("player_choice").first())?.payload;
    expect(reaction).toMatchObject({ kind: "articleReaction", intent: "disagree" });
  });
});
