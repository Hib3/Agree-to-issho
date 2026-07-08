import type { AppProfile, CharacterState, GameSettings, WordFrame } from "../../types/domain";

type DebugPanelProps = {
  profile: AppProfile | null;
  characterState: CharacterState | null;
  settings: GameSettings | null;
  words: WordFrame[];
  onSeedDebugWords: () => Promise<number>;
};

export function DebugPanel({ profile, characterState, settings, words, onSeedDebugWords }: DebugPanelProps) {
  if (!settings?.debug_panel) return null;

  async function handleSeedDebugWords() {
    const savedCount = await onSeedDebugWords();
    window.alert(savedCount > 0 ? `デバッグ用の言葉を${savedCount}こ登録しました。` : "追加できるデバッグ用の言葉はありません。");
  }

  return (
    <details className="panel debug-panel">
      <summary>DebugPanel</summary>
      <div className="debug-actions">
        <button type="button" onClick={handleSeedDebugWords}>
          デバッグ用100語を登録
        </button>
      </div>
      <pre>{JSON.stringify({ profile, characterState, wordCount: words.length }, null, 2)}</pre>
    </details>
  );
}
