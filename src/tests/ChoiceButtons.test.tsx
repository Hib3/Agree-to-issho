import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChoiceButtons } from "../ui/components/ChoiceButtons";

function Harness() {
  const [value, setValue] = useState("food");
  return (
    <ChoiceButtons
      options={[
        { value: "food", label: "食べ物" },
        { value: "place", label: "場所" }
      ]}
      value={value}
      onChoose={setValue}
    />
  );
}

describe("ChoiceButtons", () => {
  it("allows changing the selected option repeatedly", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const food = screen.getByRole("button", { name: "食べ物" });
    const place = screen.getByRole("button", { name: "場所" });

    expect(food.getAttribute("aria-pressed")).toBe("true");
    expect(place.hasAttribute("disabled")).toBe(false);
    await user.click(place);
    expect(place.getAttribute("aria-pressed")).toBe("true");
    expect(food.getAttribute("aria-pressed")).toBe("false");
    await user.click(food);
    expect(food.getAttribute("aria-pressed")).toBe("true");
  });
});
