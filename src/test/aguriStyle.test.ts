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
    expect(text.endsWith("！？")).toBe(true);
  });

  it("keeps the baseline high-energy while varying the opener", () => {
    const template = dialogueTemplates[0];
    const styled = [0, 1, 2, 3].map((turnIndex) => applyAguriStyle({ template, renderedText: "今日はノートを見ます。", speechAct: "recall_word", word: null, turnIndex }));
    expect(styled.every((text) => /っ！/.test(text))).toBe(true);
    expect(new Set(styled).size).toBeGreaterThanOrEqual(3);
  });

  it("uses praise markers only for positive reactions", () => {
    const template = dialogueTemplates.find((item) => item.speech_act === "praise_user")!;
    const text = applyAguriStyle({ template, renderedText: "教えてくれてありがとう。覚えておきます。", speechAct: "praise_user", word: null, turnIndex: 2 });
    expect(text).toContain("めっちゃ");
    expect(text).toContain("教えてくれてありがとう");
    expect(text).toContain("覚えておき");
  });

  it("uses the signature laugh only after comic release and not consecutively", () => {
    const template = dialogueTemplates.find((item) => item.speech_act === "misunderstanding_joke")!;
    const first = applyAguriStyle({ template, renderedText: "ちょっと変な使い方になりました。", speechAct: "misunderstanding_joke", word: null, turnIndex: 10, recentTexts: [] });
    const second = applyAguriStyle({ template, renderedText: "また少しズレました。", speechAct: "misunderstanding_joke", word: null, turnIndex: 15, recentTexts: [first] });
    expect(first).toMatch(/(?:ぎゃ){4,6}っ！/);
    expect(second).not.toContain("ぎゃぎゃ");
  });

  it("keeps short clauses on separate lines without dropping content", () => {
    const template = dialogueTemplates[0];
    const text = applyAguriStyle({ template, renderedText: "今日はノートを見ました。言葉を一つ思い出しました。あとでまた話します。", speechAct: "recall_word", word: null, turnIndex: 0 });
    expect(text.split("\n").length).toBeGreaterThanOrEqual(3);
    expect(text).toContain("今日はノートを見");
    expect(text).toContain("あとでまた話し");
    expect(text.split("\n").every((line) => /(?:っ！|っ！？)$/.test(line))).toBe(true);
  });

  it("does not mistake a learned feeling word for an empathy reaction", () => {
    const template = dialogueTemplates.find((item) => item.id === "relation_check_pair")!;
    const text = applyAguriStyle({ template, renderedText: "「さみしい」と「うれしい」は関係がありますか？", speechAct: "ask_relation", word: null, turnIndex: 1 });
    expect(text).not.toContain("わかるよォっ");
    expect(text).toContain("さみしい");
  });
});
