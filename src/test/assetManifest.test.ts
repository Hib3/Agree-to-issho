import { describe, expect, it } from "vitest";
import { getCharacterImagePath, mainCharacterAssetManifest } from "../data/initial/assetManifest";

describe("character asset manifest", () => {
  it("only exposes approved runtime assets", () => {
    expect(mainCharacterAssetManifest.every((asset) => asset.status === "approved")).toBe(true);
    expect(getCharacterImagePath("happy")).toBe("assets/characters/main/fullbody/approved/aguri_normal.png");
    expect(getCharacterImagePath("idle_normal")).toBe("assets/characters/main/fullbody/approved/aguri_normal.png");
  });
});
