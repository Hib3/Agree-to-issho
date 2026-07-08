// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChoiceButtons } from "../components/ChoiceButtons";

describe("ChoiceButtons", () => {
  afterEach(() => cleanup());

  it("calls onChoose every time and keeps unselected options enabled", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const { rerender } = render(
      <ChoiceButtons
        value="food"
        options={[
          { value: "food", label: "食べ物" },
          { value: "place", label: "場所" }
        ]}
        onChoose={onChoose}
      />
    );

    await user.click(screen.getByTestId("choice-food"));
    expect(onChoose).toHaveBeenLastCalledWith("food");

    const place = screen.getByTestId("choice-place");
    expect((place as HTMLButtonElement).disabled).toBe(false);
    await user.click(place);
    expect(onChoose).toHaveBeenLastCalledWith("place");

    rerender(
      <ChoiceButtons
        value="place"
        options={[
          { value: "food", label: "食べ物" },
          { value: "place", label: "場所" }
        ]}
        onChoose={onChoose}
      />
    );

    expect(screen.getByTestId("choice-place").getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByTestId("choice-food") as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables options only when the disabled prop is true", () => {
    render(
      <ChoiceButtons
        disabled
        options={[
          { value: "food", label: "食べ物" },
          { value: "place", label: "場所" }
        ]}
        onChoose={() => undefined}
      />
    );

    expect((screen.getByTestId("choice-food") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("choice-place") as HTMLButtonElement).disabled).toBe(true);
  });
});
