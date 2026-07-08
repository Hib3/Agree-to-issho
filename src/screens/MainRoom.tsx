import { CharacterStage } from "../components/character/CharacterStage";
import { DialogueBox } from "../components/DialogueBox";
import { useEffect, useState, type CSSProperties } from "react";
import type { AppProfile, CharacterState, DiaryEntry, DialogueTurn, WordFrame } from "../types/domain";

type RoomAction = "speak" | "teach" | "wordbook" | "diary" | "settings" | "import-export" | "manual" | "title";

type MainRoomProps = {
  profile: AppProfile | null;
  characterState: CharacterState | null;
  words: WordFrame[];
  latestDiary?: DiaryEntry;
  turn: DialogueTurn;
  onAction: (action: RoomAction) => void;
  onSeedSampleWords: () => Promise<number>;
  onDriftFeedback: (mode: "correct" | "keep", note?: string) => void;
};

export function MainRoom({ profile, characterState, words, latestDiary, turn, onAction, onSeedSampleWords, onDriftFeedback }: MainRoomProps) {
  const [correctionNote, setCorrectionNote] = useState("");
  const name = characterState?.character_name ?? "アグリちゃん";
  const playerName = profile?.player_name ?? "あなた";
  const reviewTargetCount = words.filter((word) => !word.is_blocked && !word.is_sensitive && !word.forgotten_at && (word.confidence < 0.58 || word.ambiguity_score > 0.72 || word.category === "unknown")).length;
  const canGiveDriftFeedback = turn.used_words.length > 0 && (turn.speech_act === "misunderstanding_joke" || turn.speech_act === "ask_correction");
  const backgroundImage = `${import.meta.env.BASE_URL}assets/backgrounds/aguri_room_desk.webp`;
  const roomStyle = {
    backgroundImage: `linear-gradient(180deg, rgba(255, 250, 242, 0.03), rgba(47, 33, 23, 0.08)), url("${backgroundImage}")`
  } as CSSProperties;

  useEffect(() => {
    setCorrectionNote("");
  }, [turn.text]);

  return (
    <main className="screen main-room-screen">
      <section className="aguri-room" style={roomStyle}>
        <header className="room-header">
          <strong>{playerName}の部屋</strong>
          <span>言葉 {words.length}こ</span>
          <button type="button" onClick={() => onAction("settings")}>設定</button>
        </header>

        <div className="room-stage">
          <CharacterStage name={name} expression={turn.expression} motionHint={turn.motion_hint} wordCount={words.length} />
          <DialogueBox speaker={name} text={turn.text} variant="bubble" emotionCode={turn.emotion_code} />
        </div>

        {words.length === 0 && (
          <section className="sample-word-note" aria-label="おためし用単語">
            <strong>まず会話を試したい時</strong>
            <span>おためし用の言葉を入れると、会話と日記の動きをすぐ見られます。</span>
            <button type="button" onClick={onSeedSampleWords}>おためし単語を100こ入れる</button>
          </section>
        )}

        {words.length > 0 && reviewTargetCount > 0 && (
          <section className="sample-word-note review-note" aria-label="復習メモ">
            <strong>聞き直したい言葉があります</strong>
            <span>{reviewTargetCount}この言葉が、まだ少しふわふわしています。</span>
            <button type="button" onClick={() => onAction("wordbook")}>単語帳で見る</button>
          </section>
        )}

        {canGiveDriftFeedback && (
          <div className="drift-actions" aria-label="言葉の直し方">
            <label>
              直す時のメモ
              <input
                value={correctionNote}
                maxLength={60}
                placeholder="例: 食べ物として使う"
                onChange={(event) => setCorrectionNote(event.target.value)}
              />
            </label>
            <button type="button" onClick={() => onDriftFeedback("correct", correctionNote)}>直す</button>
            <button type="button" onClick={() => onDriftFeedback("keep")}>そのままでいい</button>
          </div>
        )}

        <div className="primary-actions" aria-label="メイン操作">
          <button className="primary" type="button" onClick={() => onAction("speak")}>話す</button>
          <button className="primary teach" type="button" onClick={() => onAction("teach")}>言葉を教える</button>
        </div>
      </section>

      {latestDiary && (
        <section className="room-note-card" aria-label="今日のメモ">
          <strong>今日のメモ</strong>
          <span>{latestDiary.title}</span>
        </section>
      )}

      <nav className="sub-actions" aria-label="サブメニュー">
        <button type="button" onClick={() => onAction("wordbook")}>単語帳</button>
        <button type="button" onClick={() => onAction("diary")}>日記</button>
        <button type="button" onClick={() => onAction("import-export")}>保存</button>
        <button type="button" onClick={() => onAction("manual")}>説明</button>
        <button type="button" onClick={() => onAction("title")}>タイトル</button>
      </nav>
    </main>
  );
}
