import { describe, expect, it } from "vitest";
import { getCategoryLabel, getConfidenceLabel, getEmotionLabel, getSituationLabel } from "../game/word/labels";

describe("word labels", () => {
  it("maps internal values to Japanese labels", () => {
    expect(getCategoryLabel("unknown")).toBe("まだ不明");
    expect(getEmotionLabel("curious")).toBe("気になる");
    expect(getSituationLabel("room")).toBe("部屋");
    expect(getConfidenceLabel(0.4)).toBe("聞き直したい");
  });
});
