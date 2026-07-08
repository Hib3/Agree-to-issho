import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { exportSaveData, importSaveData, previewImport } from "../game/storage/exportImport";
import { clearGameStores, wordRepository } from "../game/storage/repositories";
import { applyCategory, createWordFrame } from "../game/word/createWordFrame";

describe("save import/export", () => {
  beforeEach(async () => {
    await clearGameStores(true);
  });

  it("exports valid JSON and imports it with checksum validation", async () => {
    await wordRepository.save(applyCategory(createWordFrame("あかり"), "idea"));
    const exported = await exportSaveData();
    const preview = await previewImport(JSON.stringify(exported), "replace");

    expect(exported.schema_version).toBe(2);
    expect(preview.valid).toBe(true);
    expect(preview.word_count).toBe(1);

    await clearGameStores(true);
    await importSaveData(preview);
    const imported = await wordRepository.findBySurface("あかり");
    expect(imported).toBeTruthy();
    expect(imported?.memory_strength).toBeGreaterThan(0);
  });

  it("rejects broken JSON", async () => {
    const preview = await previewImport("{broken", "merge");
    expect(preview.valid).toBe(false);
  });
});
