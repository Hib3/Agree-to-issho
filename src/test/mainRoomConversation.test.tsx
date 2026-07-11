// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MainRoom } from "../screens/MainRoom";
import { applyCategory, createWordFrame } from "../game/word/createWordFrame";

describe("MainRoom conversation answers", () => {
  it("allows changing an answer and hides the normal talk action while waiting", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const word = applyCategory(createWordFrame("カレー"), "food");
    render(
      <MainRoom
        profile={{ id: "local", player_name: "テスト", created_at: "2026-01-01", updated_at: "2026-01-01" }}
        characterState={{ id: "main", character_name: "アグリちゃん", expression: "thinking", affection: 1, energy: 90, updated_at: "2026-01-01" }}
        words={[word]}
        turn={{
          speech_act: "ask_emotion",
          text: "好きですか？",
          expression: "thinking",
          used_words: [word],
          session_id: "session_test",
          requires_answer: true,
          answer_schema: {
            kind: "single_choice",
            options: [
              { id: "like", label: "好き", value: "like" },
              { id: "dislike", label: "苦手", value: "dislike" }
            ]
          }
        }}
        activeSession={{ id: "session_test", intent: "review.preference.direct", phase: "awaiting_answer", topic_word_ids: [word.id], question_kind: "single_choice", remaining_turns: 2, started_at: "2026-01-01", updated_at: "2026-01-01" }}
        isBusy={false}
        onAction={vi.fn()}
        onSeedSampleWords={vi.fn(async () => 0)}
        onDriftFeedback={vi.fn()}
        onAnswer={onAnswer}
      />
    );

    expect(screen.queryByRole("button", { name: "話す" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "好き" }));
    await user.click(screen.getByRole("button", { name: "苦手" }));
    expect(screen.getByRole("button", { name: "好き" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "苦手" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "答える" }));
    expect(onAnswer).toHaveBeenCalledWith("dislike");
  });
});
