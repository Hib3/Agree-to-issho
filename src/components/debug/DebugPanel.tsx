import type { AppProfile, CharacterState, GameSettings, WordFrame } from "../../types/domain";

type DebugPanelProps = {
  profile: AppProfile | null;
  characterState: CharacterState | null;
  settings: GameSettings | null;
  words: WordFrame[];
};

export function DebugPanel({ profile, characterState, settings, words }: DebugPanelProps) {
  if (!settings?.debug_panel) return null;

  return (
    <details className="panel debug-panel">
      <summary>DebugPanel</summary>
      <pre>{JSON.stringify({ profile, characterState, wordCount: words.length }, null, 2)}</pre>
    </details>
  );
}
