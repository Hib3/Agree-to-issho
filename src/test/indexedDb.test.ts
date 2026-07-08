import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearGameStores, profileRepository, wordRepository } from "../game/storage/repositories";
import { createWordFrame } from "../game/word/createWordFrame";

describe("IndexedDB repositories", () => {
  beforeEach(async () => {
    await clearGameStores(true);
  });

  it("stores and reads profile and words", async () => {
    const now = new Date().toISOString();
    await profileRepository.save({ id: "local", player_name: "player", created_at: now, updated_at: now });
    await wordRepository.save(createWordFrame("ひかり"));

    expect((await profileRepository.get())?.player_name).toBe("player");
    expect(await wordRepository.findBySurface("ひかり")).toBeTruthy();
  });
});
