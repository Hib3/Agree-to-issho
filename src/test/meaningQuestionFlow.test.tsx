// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MeaningQuestionFlow } from "../screens/MeaningQuestionFlow";
import { applyCategory, applyEmotion, applySituation, createWordFrame } from "../game/word/createWordFrame";
import type { WordFrame } from "../types/domain";

function renderFlow(step: "category" | "emotion" | "situation", word: WordFrame) {
  const onStep = vi.fn();
  let currentWord = word;
  const onWordChange = vi.fn((next: WordFrame) => {
    currentWord = next;
  });
  const utils = render(
    <MeaningQuestionFlow
      step={step}
      word={currentWord}
      onStep={onStep}
      onWordChange={onWordChange}
      onComplete={vi.fn()}
    />
  );
  return { ...utils, onWordChange, getCurrentWord: () => currentWord };
}

describe("MeaningQuestionFlow selection changes", () => {
  afterEach(() => cleanup());

  it("category step allows changing selection before next", async () => {
    const user = userEvent.setup();
    const { onWordChange } = renderFlow("category", applyCategory(createWordFrame("カレー"), "unknown"));

    await user.click(screen.getByTestId("choice-food"));
    expect(onWordChange).toHaveBeenLastCalledWith(expect.objectContaining({ category: "food" }));
    await user.click(screen.getByTestId("choice-place"));
    expect(onWordChange).toHaveBeenLastCalledWith(expect.objectContaining({ category: "place" }));
  });

  it("emotion step allows changing selection before next", async () => {
    const user = userEvent.setup();
    const word = applyEmotion(createWordFrame("カレー"), "happy", "like");
    const { onWordChange } = renderFlow("emotion", word);

    await user.click(screen.getByTestId("choice-happy"));
    expect(onWordChange).toHaveBeenLastCalledWith(expect.objectContaining({ emotion_tags: ["happy"] }));
    await user.click(screen.getByTestId("choice-sad"));
    expect(onWordChange).toHaveBeenLastCalledWith(expect.objectContaining({ emotion_tags: ["sad"] }));
  });

  it("situation step allows changing selection before next", async () => {
    const user = userEvent.setup();
    const word = applySituation(createWordFrame("カレー"), "room");
    const { onWordChange } = renderFlow("situation", word);

    await user.click(screen.getByTestId("choice-room"));
    expect(onWordChange).toHaveBeenLastCalledWith(expect.objectContaining({ situation_tags: ["room"] }));
    await user.click(screen.getByTestId("choice-diary"));
    expect(onWordChange).toHaveBeenLastCalledWith(expect.objectContaining({ situation_tags: ["diary"] }));
  });

  it("option grid buttons are not disabled by default", () => {
    renderFlow("category", createWordFrame("カレー"));
    const buttons = screen.getAllByRole("button").filter((button) => button.closest(".option-grid"));
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => !button.hasAttribute("disabled"))).toBe(true);
  });
});
