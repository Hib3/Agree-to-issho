import { describe, expect, it } from "vitest";
import { dialogueTemplates } from "../data/templates/dialogueTemplates";
import { applyAguriStyle } from "../game/dialogue/applyAguriStyle";
import { TemplateDialogueEngine } from "../game/dialogue/TemplateDialogueEngine";
import { applyCategory, applyEmotion, applySituation, createWordFrame } from "../game/word/createWordFrame";

describe("Aguri style layer", () => {
  it("applies style without copying raw long source text", () => {
    const template = dialogueTemplates.find((item) => item.speech_act === "ask_new_word");
    expect(template).toBeTruthy();
    const text = applyAguriStyle({
      template: template!,
      renderedText: template!.text,
      speechAct: "ask_new_word",
      word: null,
      turnIndex: 1
    });

    expect(text).toContain("新しい言葉");
    expect(text.length).toBeLessThan(90);
    expect(text).not.toContain("Reddit");
  });

  it("keeps one learned word in a styled utterance", () => {
    const engine = new TemplateDialogueEngine();
    const word = applySituation(applyEmotion(applyCategory(createWordFrame("夕焼け"), "idea"), "curious", "neutral"), "daily_talk");
    const turn = engine.next({
      profile: null,
      character_state: null,
      settings: null,
      words: [{ ...word, confidence: 0.9, use_count: 1 }],
      now: new Date().toISOString()
    });

    const occurrences = turn.text.split("夕焼け").length - 1;
    expect(occurrences).toBeLessThanOrEqual(1);
    expect(turn.text).toMatch(/[ァォェ]っ/);
    expect((turn.text.match(/[ァォェ]っ/g) ?? []).length).toBeLessThanOrEqual(2);
  });
});
