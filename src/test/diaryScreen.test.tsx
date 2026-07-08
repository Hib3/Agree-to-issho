// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiaryScreen } from "../screens/DiaryScreen";
import { createWordFrame } from "../game/word/createWordFrame";
import type { DiaryEntry } from "../types/domain";

describe("DiaryScreen", () => {
  afterEach(() => cleanup());

  it("shows used word chips and opens wordbook from them", async () => {
    const user = userEvent.setup();
    const word = createWordFrame("カレー");
    const onOpenWordbook = vi.fn();
    const entry: DiaryEntry = {
      id: "diary_test",
      entry_date: "2026-07-08",
      title: "今日のメモ",
      body: "今日は「カレー」を思い出しました。",
      used_word_ids: [word.id],
      mood: "happy",
      created_at: "2026-07-08T10:00:00.000Z"
    };

    render(<DiaryScreen entries={[entry]} words={[word]} onGenerate={vi.fn()} onOpenWordbook={onOpenWordbook} onBack={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "カレー" }));
    expect(onOpenWordbook).toHaveBeenCalledTimes(1);
  });
});
