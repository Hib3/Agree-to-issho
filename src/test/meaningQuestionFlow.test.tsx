// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MeaningQuestionFlow } from "../screens/MeaningQuestionFlow";
import { applyCategory, applyEmotion, applySituation, createWordFrame } from "../game/word/createWordFrame";
import type { WordFrame } from "../types/domain";

function renderFlow(step: "category" | "detail" | "emotion" | "situation" | "confirm", word: WordFrame) {
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

function StatefulFlow({ step, initialWord }: { step: "emotion" | "situation"; initialWord: WordFrame }) {
  const [word, setWord] = useState(initialWord);
  return (
    <MeaningQuestionFlow
      step={step}
      word={word}
      onStep={vi.fn()}
      onWordChange={setWord}
      onComplete={vi.fn()}
    />
  );
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

  it("detail step changes by category and stores the answer", async () => {
    const user = userEvent.setup();
    const food = applyCategory(createWordFrame("カレー"), "food");
    const { onWordChange, unmount } = renderFlow("detail", food);

    expect(screen.getByText("それは、おいしそう？")).toBeTruthy();
    await user.click(screen.getByTestId("choice-like"));
    expect(onWordChange).toHaveBeenLastCalledWith(expect.objectContaining({ user_stance: "like", emotion_tags: ["happy"] }));

    unmount();
    renderFlow("detail", applyCategory(createWordFrame("公園"), "place"));
    expect(screen.getByText("そこは、行ってみたい場所？")).toBeTruthy();
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

  it("emotion step visually switches from 好き to 大事 and keeps navigation clickable", async () => {
    const user = userEvent.setup();
    render(<StatefulFlow step="emotion" initialWord={applyEmotion(createWordFrame("カレー"), "happy", "like")} />);

    await user.click(screen.getByTestId("choice-proud"));
    expect(screen.getByTestId("choice-happy").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("choice-proud").getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "戻る" }));
    await user.click(screen.getByRole("button", { name: "次へ" }));
  });

  it("situation step visually switches from 日常 to 部屋 and keeps navigation clickable", async () => {
    const user = userEvent.setup();
    render(<StatefulFlow step="situation" initialWord={applySituation(createWordFrame("カレー"), "daily_talk")} />);

    await user.click(screen.getByTestId("choice-room"));
    expect(screen.getByTestId("choice-daily_talk").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("choice-room").getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "戻る" }));
    await user.click(screen.getByRole("button", { name: "次へ" }));
  });

  it("option grid buttons are not disabled by default", () => {
    renderFlow("category", createWordFrame("カレー"));
    const buttons = screen.getAllByRole("button").filter((button) => button.closest(".option-grid"));
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => !button.hasAttribute("disabled"))).toBe(true);
  });

  it("confirm step shows a player-facing memo instead of internal category values", () => {
    const food = {
      ...applyCategory(createWordFrame("カレー"), "food"),
      user_stance: "like" as const,
      emotion_tags: ["happy" as const],
      situation_tags: ["room" as const],
      relation_tags: []
    };

    renderFlow("confirm", food);

    expect(screen.getByText("好きな食べ物")).toBeTruthy();
    expect(screen.queryByText("food")).toBeNull();
  });
});
