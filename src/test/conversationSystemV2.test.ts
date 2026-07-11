import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { applyCategory, createWordFrame } from "../game/word/createWordFrame";
import {
  answerConversation,
  closeConversation,
  completeConversation,
  createConversationSession,
  createPlayerAnswerLog
} from "../game/dialogue/conversationSession";
import { clearGameStores, conversationSessionRepository, dialogueLogRepository } from "../game/storage/repositories";
import type { DialogueTurn } from "../types/domain";

describe("Conversation System v2", () => {
  beforeEach(async () => clearGameStores(true));

  it("persists an awaiting answer, learns from the answer, then completes", async () => {
    const now = "2026-07-11T09:00:00.000Z";
    const word = { ...applyCategory(createWordFrame("カレー"), "food"), user_stance: "unknown" as const };
    const opening: DialogueTurn = {
      speech_act: "ask_emotion",
      text: "「カレー」は好きな方ですか？",
      expression: "thinking",
      used_words: [word],
      template_id: "preference_check_direct",
      semantic_key: "review.preference.direct",
      session_id: "session_test",
      requires_answer: true,
      answer_schema: {
        kind: "single_choice",
        options: [
          { id: "like", label: "好き", value: "like" },
          { id: "dislike", label: "苦手", value: "dislike" }
        ]
      }
    };
    const session = { ...createConversationSession(opening, now), prompt_log_id: "prompt_1" };
    await conversationSessionRepository.save(session);

    const restored = await conversationSessionRepository.get(session.id);
    expect(restored?.phase).toBe("awaiting_answer");

    const playerLog = createPlayerAnswerLog(session, "like", "", now);
    await dialogueLogRepository.save(playerLog);
    expect((await dialogueLogRepository.get(playerLog.id))?.role).toBe("player");

    const answer = answerConversation(session, "like", [word], now);
    expect(answer.session.phase).toBe("reaction");
    expect(answer.updated_words[0].user_stance).toBe("like");
    expect(answer.updated_words[0].confidence).toBeGreaterThan(word.confidence);

    const closed = closeConversation(answer.session, answer.updated_words[0], now);
    expect(closed.session.phase).toBe("closing");
    const completed = completeConversation(closed.session, now);
    expect(completed.phase).toBe("completed");
    expect(completed.completed_at).toBe(now);
  });

  it("stores free text as plain, bounded notes", () => {
    const now = "2026-07-11T09:00:00.000Z";
    const word = applyCategory(createWordFrame("散歩"), "action");
    const session = {
      id: "session_free",
      intent: "review.situation.free",
      phase: "awaiting_answer" as const,
      topic_word_ids: [word.id],
      question_kind: "free_text" as const,
      remaining_turns: 2,
      started_at: now,
      updated_at: now
    };
    const result = answerConversation(session, "free_text", [word], now, "<b>夕方の公園</b>で使う");
    expect(result.updated_words[0].notes).toContain("夕方の公園");
    expect(result.updated_words[0].notes).not.toContain("<b>");
  });
});
