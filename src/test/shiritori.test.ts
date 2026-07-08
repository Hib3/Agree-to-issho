import { describe, expect, it } from "vitest";
import { getShiritoriCandidates } from "../game/word/shiritori";
import { applyCategory, createWordFrame } from "../game/word/createWordFrame";

describe("shiritori candidates", () => {
  it("links words by reading and excludes blocked words", () => {
    const ramen = { ...applyCategory(createWordFrame("ラーメン"), "food"), reading: "らめ" };
    const memo = { ...applyCategory(createWordFrame("メモ"), "object"), reading: "めも" };
    const blocked = { ...applyCategory(createWordFrame("もり"), "place"), reading: "もり", is_blocked: true };
    const room = { ...applyCategory(createWordFrame("ものさし"), "object"), reading: "ものさし" };

    const candidates = getShiritoriCandidates([ramen, memo, blocked, room]);

    expect(candidates[0].from.surface).toBe("ラーメン");
    expect(candidates[0].next.map((word) => word.surface)).toContain("メモ");
    expect(candidates.flatMap((item) => item.next).map((word) => word.surface)).not.toContain("もり");
  });
});
