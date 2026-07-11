// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DialogueBox } from "../components/DialogueBox";

describe("DialogueBox text paging", () => {
  afterEach(cleanup);
  it("reveals the current page before advancing to the next one", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(
      <DialogueBox
        speaker="アグリちゃん"
        text="言葉をつないで、お話を作っていますっ！"
        animateText
        textSpeed="slow"
        onNext={onNext}
      />
    );

    await user.click(screen.getByRole("button", { name: "全文を表示" }));
    expect(screen.getByText("言葉をつないで、お話を作っていますっ！")).toBeTruthy();
    expect(onNext).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("does not show an advance marker without an advance action", () => {
    render(<DialogueBox speaker="アグリちゃん" text="ここでおしまいです。" />);
    expect(screen.queryByRole("button", { name: "次へ" })).toBeNull();
  });
});
