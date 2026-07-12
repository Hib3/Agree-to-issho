import { useState } from "react";
import type { ImportMode, ImportPreview } from "../../infrastructure/backup/importSave";
import { applyImport, previewImport } from "../../infrastructure/backup/importSave";
import { exportSaveFile } from "../../infrastructure/backup/exportSave";
import type { LegacyPreview } from "../../infrastructure/db/legacyImporter";
import { importLegacyPreview, previewLegacyImport } from "../../infrastructure/db/legacyImporter";
import { ScreenHeader } from "../../ui/components/ScreenHeader";
import { StorageStatus } from "../../ui/components/StorageStatus";

export function BackupScreen({ onBack, onChanged }: { onBack: () => void; onChanged: () => Promise<void> }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [legacy, setLegacy] = useState<LegacyPreview | null>(null);
  const [message, setMessage] = useState("");

  async function download() {
    const blob = await exportSaveFile();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aguri-cleanroom-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function readFile(file?: File) {
    if (!file) return;
    setPreview(await previewImport(await file.text()));
  }

  async function importBackup() {
    if (!preview) return;
    await applyImport(preview, mode);
    setMessage("バックアップを読み込みました。");
    await onChanged();
  }

  async function inspectLegacy() {
    const result = await previewLegacyImport();
    setLegacy(result);
    if (!result.available) setMessage("旧版の保存データはこの端末にありません。");
  }

  async function importLegacy() {
    if (!legacy) return;
    await importLegacyPreview(legacy);
    setMessage("旧版の言葉を新しい単語帳へコピーしました。旧データは変更していません。");
    await onChanged();
  }

  return (
    <main className="feature-screen">
      <ScreenHeader title="保存データ" onBack={onBack} />
      <section className="paper-panel backup-panel">
        <h2>JSONバックアップ</h2>
        <button className="primary" type="button" onClick={() => void download()}>この端末のデータを書き出す</button>
        <label>バックアップを選ぶ<input type="file" accept="application/json" onChange={(event) => void readFile(event.target.files?.[0])} /></label>
        {preview ? <div className={preview.valid ? "import-valid" : "warning"}><strong>{preview.valid ? "読み込み可能" : "読み込めません"}</strong><p>{Object.entries(preview.counts).map(([key, value]) => `${key}: ${value}`).join(" / ")}</p>{preview.errors.map((error) => <p key={error}>{error}</p>)}{preview.unknownFields.map((field) => <p key={field}>未対応項目: {field}</p>)}</div> : null}
        {preview?.valid ? <><label>読み込み方法<select value={mode} onChange={(event) => setMode(event.target.value as ImportMode)}><option value="merge">今のデータとまとめる</option><option value="replace">今のデータを置き換える</option></select></label><button type="button" onClick={() => void importBackup()}>確認して読み込む</button></> : null}
      </section>
      <section className="paper-panel backup-panel">
        <h2>旧版から言葉を移す</h2>
        <p>旧版の保存領域は読み取りだけ行い、削除や更新はしません。</p>
        <button type="button" onClick={() => void inspectLegacy()}>旧データを確認</button>
        {legacy?.available ? <div><p>変換できる言葉: {legacy.concepts.length}こ</p><p>確認事項: {legacy.warnings.length}こ</p><button type="button" onClick={() => void importLegacy()}>新しい単語帳へコピー</button></div> : null}
      </section>
      <StorageStatus />
      {message ? <p className="notice" role="status">{message}</p> : null}
    </main>
  );
}
