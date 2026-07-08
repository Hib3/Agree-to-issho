import { useState } from "react";
import type { GameSettings, WordFrame } from "../../types/domain";

type DebugPanelProps = {
  settings: GameSettings | null;
  words: WordFrame[];
  onSeedSampleWords: () => Promise<number>;
};

export function DebugPanel({ settings, words, onSeedSampleWords }: DebugPanelProps) {
  const [message, setMessage] = useState("");
  if (!settings?.debug_panel) return null;

  async function handleSeedSampleWords() {
    const savedCount = await onSeedSampleWords();
    setMessage(savedCount > 0 ? `おためし用の言葉を${savedCount}こ入れました。` : "追加できるおためし用の言葉はありません。");
  }

  return (
    <details className="panel debug-panel sample-panel">
      <summary>おためし準備</summary>
      <p>会話や日記の動きを確認するための、汎用的な日常語を入れます。</p>
      <div className="debug-actions">
        <button type="button" onClick={handleSeedSampleWords}>
          おためし単語を100こ入れる
        </button>
      </div>
      <p className="muted">今の言葉: {words.length}こ</p>
      {message && <p className="sample-status">{message}</p>}
    </details>
  );
}
