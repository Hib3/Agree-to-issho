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
    expect((turn.text.match(/[ァォェ]っ/g) ?? []).length).toBeLessThanOrEqual(4);
  });

  it("keeps slots, questions, and negation intact", () => {
    const template = dialogueTemplates.find((item) => item.id === "relation_check_pair")!;
    const text = applyAguriStyle({
      template,
      renderedText: "「カレー」と「お茶」は、関係ない言葉ですか？",
      speechAct: "ask_relation",
      word: null,
      turnIndex: 3
    });
    expect(text).toContain("カレー");
    expect(text).toContain("お茶");
    expect(text).toContain("関係ない");
    expect(text.endsWith("？")).toBe(true);
  });

  it("does not force a strong catchphrase onto every utterance", () => {
    const template = dialogueTemplates[0];
    const styled = [0, 1, 2, 3].map((turnIndex) => applyAguriStyle({ template, renderedText: "今日はノートを見ます。", speechAct: "recall_word", word: null, turnIndex }));
    expect(styled.some((text) => !/[ァ-ヴ]っ/.test(text))).toBe(true);
    expect(styled[0]).not.toBe(styled[1]);
  });
});
