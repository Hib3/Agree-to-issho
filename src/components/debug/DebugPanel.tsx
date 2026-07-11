import { useState } from "react";
import type { DialogueDebugInfo } from "../../game/dialogue/TemplateDialogueEngine";
import type { CharacterState, ConversationSession, GameSettings, WordFrame } from "../../types/domain";

type DebugPanelProps = {
  settings: GameSettings | null;
  words: WordFrame[];
  onSeedSampleWords: () => Promise<number>;
  debugInfo?: DialogueDebugInfo | null;
  session?: ConversationSession | null;
  characterState?: CharacterState | null;
  autoTalkEnabled?: boolean;
  autoTalkDueAt?: string | null;
};

export function DebugPanel({ settings, words, onSeedSampleWords, debugInfo, session, characterState, autoTalkEnabled, autoTalkDueAt }: DebugPanelProps) {
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
      {debugInfo && (
        <dl className="debug-details">
          <div><dt>状態</dt><dd>{debugInfo.state.state}</dd></div>
          <div><dt>テンプレート</dt><dd>{debugInfo.selected_template_id}</dd></div>
          <div><dt>意味キー</dt><dd>{debugInfo.semantic_key}</dd></div>
          <div><dt>選択語</dt><dd>{debugInfo.selected_word ? `${debugInfo.selected_word.surface} / score ${debugInfo.selected_word.score?.toFixed(2)} / weight ${debugInfo.selected_word.weight?.toFixed(2)}` : "なし"}</dd></div>
          <div><dt>候補状態</dt><dd>{debugInfo.state.candidates.map((item) => `${item.state}:${item.weight}`).join(" / ")}</dd></div>
          <div><dt>除外</dt><dd>{debugInfo.excluded_templates.map((item) => `${item.id}:${item.reason}`).join(" / ") || "なし"}</dd></div>
          <div><dt>制約緩和</dt><dd>{debugInfo.relaxed_constraints.join(" / ") || "なし"}</dd></div>
        </dl>
      )}
      <dl className="debug-details">
        <div><dt>会話</dt><dd>{session ? `${session.phase} (${session.intent})` : "なし"}</dd></div>
        <div><dt>回答待ち</dt><dd>{session?.phase === "awaiting_answer" ? "はい" : "いいえ"}</dd></div>
        <div><dt>自動発話</dt><dd>{autoTalkEnabled ? `待機中 (${autoTalkDueAt ?? "再計算中"})` : "停止"}</dd></div>
        <div><dt>最終ユーザー操作</dt><dd>{characterState?.last_user_interaction_at ?? "不明"}</dd></div>
        <div><dt>最終キャラクター発話</dt><dd>{characterState?.last_character_speech_at ?? "不明"}</dd></div>
      </dl>
      {message && <p className="sample-status">{message}</p>}
    </details>
  );
}
