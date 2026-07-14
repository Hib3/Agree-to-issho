import { describe, expect, it } from "vitest";
import { extractGroundedNewsFact, realizeGroundedNewsFact } from "../domain/news/newsFactFrame";

describe("grounded Japanese news fact frames", () => {
  it.each([
    [
      "交通局が新しい案内表示を七月から試す。",
      "交通局",
      "案内表示",
      "test",
      "本文からは、交通局が案内表示を試していることを確認できます。"
    ],
    [
      "木原官房長官は前日の発言について、その趣旨を説明しました。",
      "木原官房長官",
      "発言の趣旨",
      "explain",
      "本文からは、木原官房長官が発言の趣旨を説明したことを確認できます。"
    ],
    [
      "Stanford Digital Economy Labが雇用への影響を扱う声明を発表しました。",
      "Stanford Digital Economy Lab",
      "声明",
      "announce",
      "本文からは、Stanford Digital Economy Labが声明を発表したことを確認できます。"
    ],
    [
      "カリフォルニア州議会で、16歳未満を対象とする法案を検討しています。",
      undefined,
      "法案",
      "consider",
      "本文からは、法案が検討されていることを確認できます。"
    ],
    [
      "政府・与党は、関連法案の成立に向けて今国会の会期を1週間ほど延長する検討に入った。",
      "政府・与党",
      "会期の延長",
      "consider",
      "本文からは、政府・与党が会期の延長を検討していることを確認できます。"
    ]
  ])("paraphrases %s without copying the source sentence", (source, subject, object, action, expected) => {
    const frame = extractGroundedNewsFact(source);
    expect(frame?.subject).toBe(subject);
    expect(frame?.object).toBe(object);
    expect(frame?.action).toBe(action);
    expect(realizeGroundedNewsFact(frame!, "本文からは、")).toBe(expected);
    expect(expected).not.toBe(source);
  });

  it("refuses to invent a fact when neither a grounded subject nor object can be found", () => {
    expect(extractGroundedNewsFact("何となく新しい動きがありそうです。")).toBeUndefined();
    expect(extractGroundedNewsFact("発表されました。")).toBeUndefined();
  });

  it("does not expose an unknown marker attached to source prose", () => {
    const frame = extractGroundedNewsFact("交通局が案内表示を試す。RAW_SOURCE_MARKER_42");
    const result = realizeGroundedNewsFact(frame!, "本文からは、");
    expect(result).toBe("本文からは、交通局が案内表示を試していることを確認できます。");
    expect(result).not.toContain("RAW_SOURCE_MARKER");
  });

  it("describes an anonymous product trial without an awkward passive", () => {
    const frame = extractGroundedNewsFact(
      "今回、自動圧縮機能つきのバッグに服を詰め、商品を実際に使ってみました。"
    );
    expect(realizeGroundedNewsFact(frame!, "本文からは、")).toBe(
      "本文からは、商品を実際に試した内容だと確認できます。"
    );
  });
});
