import { describe, expect, it } from "vitest";
import { applyAguriVoice } from "../domain/voice/aguriVoice";

describe("Aguri voice layer", () => {
  it("keeps the energy without forcing an opener onto ordinary speech", () => {
    const result = applyAguriVoice("今日はこの言葉を覚えます。", "happy");

    expect(result).toBe("今日はこの言葉を覚えますっ！");
    expect(result).not.toMatch(/^(まァっ、|なんかっ、)/u);
    expect(result).not.toContain("まァっすっ");
  });

  it("does not erase learned words", () => {
    expect(applyAguriVoice("「星形クッキー」を覚えます。", "curious")).toContain("星形クッキー");
  });

  it("does not append a second ending after an existing energetic ending", () => {
    const result = applyAguriVoice("あなたの名前を教えてくださいっ。", "curious");
    expect(result).toBe("あなたの名前を教えてくださいっ！");
  });

  it("normalizes an already-emphatic question as one ending", () => {
    const result = applyAguriVoice("何て呼べばいいですかっ？", "happy");
    expect(result).toBe("何て呼べばいいですかっ！？");
    expect(result).not.toContain("！？っ？");
  });

  it("uses uncertainty softeners occasionally instead of on every line", () => {
    const samples = Array.from({ length: 500 }, (_, index) =>
      applyAguriVoice(`この覚え方は、まだ少し違うかもしれません。${index}`, "confused")
    );
    const softened = samples.filter((line) => /^(まァっ、|なんかっ、|あのっそのっ、)/u.test(line));
    const maa = samples.filter((line) => line.startsWith("まァっ、"));

    expect(softened.length).toBeGreaterThan(80);
    expect(softened.length).toBeLessThan(230);
    expect(maa.length).toBeGreaterThan(10);
    expect(maa.length).toBeLessThan(80);
  });

  it("is idempotent for an already styled line", () => {
    const once = applyAguriVoice("なんかっ、この使い方は違うかもしれません。", "confused");
    expect(applyAguriVoice(once, "confused")).toBe(once);
  });
});
