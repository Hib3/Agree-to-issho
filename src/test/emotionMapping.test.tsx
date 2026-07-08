// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DialogueBox } from "../components/DialogueBox";
import { CharacterStage } from "../components/character/CharacterStage";
import { getEmotionCode, getMotionHint } from "../game/dialogue/emotionMapping";

describe("emotion and motion mapping", () => {
  afterEach(() => cleanup());

  it("maps correction turns to inquisitive UI state", () => {
    const emotion = getEmotionCode("ask_correction", "confused");
    expect(emotion).toBe("inquisitive");
    expect(getMotionHint(emotion)).toBe("sway");
  });

  it("adds emotion class to DialogueBox", () => {
    render(<DialogueBox speaker="アグリちゃん" text="聞いてもいい？" variant="bubble" emotionCode="inquisitive" />);
    expect(screen.getByText("聞いてもいい？").closest("section")?.className).toContain("emotion-inquisitive");
  });

  it("adds motion class to CharacterStage", () => {
    render(<CharacterStage name="アグリちゃん" expression="talk_smile" motionHint="bounce" wordCount={3} />);
    expect(screen.getByLabelText("アグリちゃんの部屋").className).toContain("motion-bounce");
  });
});
