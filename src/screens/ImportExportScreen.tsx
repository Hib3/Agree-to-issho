import { ChangeEvent, useState } from "react";
import type { ImportPreview } from "../types/domain";

type ImportExportScreenProps = {
  onBack: () => void;
  onExport: () => void;
  onPreviewImport: (raw: string, mode: "replace" | "merge") => Promise<ImportPreview>;
  onApplyImport: (preview: ImportPreview) => Promise<void>;
};

export function ImportExportScreen({ onBack, onExport, onPreviewImport, onApplyImport }: ImportExportScreenProps) {
  const [mode, setMode] = useState<"replace" | "merge">("merge");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      setPreview(await onPreviewImport(await file.text(), mode));
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    if (!preview) return;
    setBusy(true);
    try {
      await onApplyImport(preview);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen narrow-screen">
      <div className="topbar">
        <h1>保存データ</h1>
        <button type="button" onClick={onBack}>戻る</button>
      </div>
      <section className="panel form-stack">
        <button className="primary" type="button" onClick={onExport}>バックアップを書き出す</button>
        <label>
          読み込み方法
          <select value={mode} onChange={(event) => setMode(event.target.value as "replace" | "merge")}>
            <option value="merge">今の部屋に足す</option>
            <option value="replace">部屋を入れ替える</option>
          </select>
        </label>
        <input type="file" accept="application/json,.json" onChange={handleFile} />
      </section>
      {preview && (
        <section className="panel">
          <h2>読み込み前の確認</h2>
          <dl className="summary-list">
            <div><dt>読み込み</dt><dd>{preview.valid ? "できます" : "できません"}</dd></div>
            <div><dt>言葉</dt><dd>{preview.word_count}</dd></div>
            <div><dt>日記</dt><dd>{preview.diary_count}</dd></div>
            <div><dt>同じ言葉</dt><dd>{preview.conflict_surfaces.length}</dd></div>
          </dl>
          {preview.errors.length > 0 && <p className="warning">{preview.errors.join(" / ")}</p>}
          {preview.conflict_surfaces.length > 0 && <p className="notice">同じ表記は、わかった度が高い方を優先します。</p>}
          <button type="button" disabled={!preview.valid || busy} onClick={handleApply}>読み込む</button>
        </section>
      )}
    </main>
  );
}
