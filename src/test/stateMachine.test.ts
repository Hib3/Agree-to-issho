import { describe, expect, it } from "vitest";
import { createDebugWordSeed } from "../data/debug/debugWordSeed";
import { chooseNextState, stateToSpeechAct } from "../game/dialogue/stateMachine";
import type { DialogueContext } from "../types/domain";

function context(partial: Partial<DialogueContext>): DialogueContext {
  return {
    profile: null,
    character_state: null,
    settings: null,
    words: [],
    now: "2026-07-08T09:00:00.000Z",
    ...partial
  };
}

describe("dialogue state machine", () => {
  it("asks for a new word when no usable words exist", () => {
    expect(chooseNextState(context({ words: [] }))).toBe("ask_new_word");
  });

  it("mixes recall or drift states when many words exist", () => {
    const words = createDebugWordSeed();
    const states = new Set(
      Array.from({ length: 12 }, (_, index) =>
        chooseNextState(context({ words, now: `2026-07-08T09:${String(index).padStart(2, "0")}:00.000Z` }))
      )
    );

    expect([...states].some((state) => state === "recall_word" || state === "drift_talk" || state === "review_prompt")).toBe(true);
  });

  it("maps review prompt to an existing correction speech act", () => {
    expect(stateToSpeechAct("review_prompt")).toBe("ask_correction");
  });
});
