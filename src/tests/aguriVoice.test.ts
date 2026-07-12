import { describe, expect, it } from "vitest";
import { applyAguriVoice } from "../domain/voice/aguriVoice";

describe("Aguri voice layer", () => {
  it("applies the energetic style to ordinary generated text", () => {
    const result = applyAguriVoice("今日はこの言葉を覚えます。", "happy");
    expect(result).toMatch(/^(まァっ、|なんかっ、)/u);
    expect(result).toContain("まァっすっ！");
  });

  it("does not erase learned words", () => {
    expect(applyAguriVoice("「星形クッキー」を覚えます。", "curious")).toContain("星形クッキー");
  });

  it("does not append a second ending after an existing energetic ending", () => {
    const result = applyAguriVoice("あなたの名前を教えてくださいっ。", "curious");
    expect(result).toContain("教えてくださいっ！");
    expect(result).not.toContain("。 ですねェっ！");
  });

  it("normalizes an already-emphatic question as one ending", () => {
    const result = applyAguriVoice("何て呼べばいいですかっ？", "happy");
    expect(result).toContain("ですかっ！？");
    expect(result).not.toContain("！？っ？");
  });
});
