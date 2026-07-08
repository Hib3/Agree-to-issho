import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizeGameText } from "../utils/sanitizeGameText";

describe("game text hygiene", () => {
  it("removes technical lines from visible play text", () => {
    const text = sanitizeGameText("こんにちは\nschema_version: 1\nDebugPanel\nまた話そうね");

    expect(text).toBe("こんにちは\nまた話そうね");
  });

  it("does not use pointer-events rules on choice buttons", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const optionGridBlocks = css.match(/\.option-grid[^{]*\{[^}]*\}/g) ?? [];

    expect(optionGridBlocks.join("\n")).not.toContain("pointer-events");
  });
});
