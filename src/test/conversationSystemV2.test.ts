import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { applyCategory, createWordFrame } from "../game/word/createWordFrame";
import {
  advanceConversation,
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

  it("keeps an autonomous learned-word story as a paged session", async () => {
    const now = "2026-07-11T09:00:00.000Z";
    const first = applyCategory(createWordFrame("公園"), "place");
    const second = applyCategory(createWordFrame("散歩"), "action");
    const opening: DialogueTurn = {
      speech_act: "use_word_in_daily_talk",
      text: "最初のページ",
      expression: "talk_smile",
      used_words: [first, second],
      semantic_key: "composition.grounded.test",
      continuation: [{
        speech_act: "ask_relation",
        text: "このつながりで合っていますか？",
        expression: "thinking",
        used_word_ids: [first.id, second.id],
        requires_answer: true,
        answer_schema: {
          kind: "single_choice",
          options: [
            { id: "confirm", label: "合ってる", value: "confirm" },
            { id: "correct", label: "違う", value: "correct" }
          ]
        }
      }]
    };
    const session = createConversationSession(opening, now);
    await conversationSessionRepository.save(session);
    const restored = await conversationSessionRepository.get(session.id);
    const advanced = restored ? advanceConversation(restored, [first, second], now) : null;

    expect(session.phase).toBe("follow_up");
    expect(restored?.queued_turns).toHaveLength(1);
    expect(advanced?.session.phase).toBe("awaiting_answer");
    expect(advanced?.turn.text).toBe("このつながりで合っていますか？");
    expect(advanced?.turn.used_words).toHaveLength(2);
  });

  it("learns or separates every word in a composed relation from the player's answer", () => {
    const now = "2026-07-11T09:00:00.000Z";
    const first = applyCategory(createWordFrame("公園"), "place");
    const second = applyCategory(createWordFrame("散歩"), "action");
    const session = {
      id: "composition_session",
      intent: "composition.grounded.outing",
      phase: "awaiting_answer" as const,
      topic_word_ids: [first.id, second.id],
      question_kind: "single_choice" as const,
      remaining_turns: 1,
      started_at: now,
      updated_at: now
    };

    const confirmed = answerConversation(session, "confirm", [first, second], now);
    expect(confirmed.updated_words).toHaveLength(2);
    expect(confirmed.updated_words[0].related_word_ids).toContain(second.id);
    expect(confirmed.updated_words[1].related_word_ids).toContain(first.id);

    const corrected = answerConversation(session, "correct", confirmed.updated_words, now);
    expect(corrected.updated_words[0].related_word_ids).not.toContain(second.id);
    expect(corrected.updated_words[1].related_word_ids).not.toContain(first.id);
    expect(corrected.turn.speech_act).toBe("praise_user");
  });

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
