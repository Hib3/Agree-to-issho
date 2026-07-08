import { describe, expect, it } from "vitest";
import { createWordFrame } from "../game/word/createWordFrame";
import { validateWordInput } from "../game/word/wordInputValidation";

describe("word input validation", () => {
  it("trims and accepts short words", () => {
    expect(validateWordInput("  カレー  ", [])).toEqual({ ok: true, surface: "カレー" });
  });

  it("rejects empty, duplicates, urls, control characters, and long text", () => {
    expect(validateWordInput("   ", []).ok).toBe(false);
    expectReason(validateWordInput("カレー", [createWordFrame("カレー")]), "duplicate");
    expectReason(validateWordInput("https://example.com", []), "url");
    expectReason(validateWordInput("abc\u0000", []), "control");
    expectReason(validateWordInput("これはとても長すぎる言葉です", []), "too_long");
  });
});

function expectReason(result: ReturnType<typeof validateWordInput>, reason: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.reason).toBe(reason);
}
