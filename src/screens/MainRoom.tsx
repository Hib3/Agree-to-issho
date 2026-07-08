import { CharacterStage } from "../components/character/CharacterStage";
import { DialogueBox } from "../components/DialogueBox";
import type { CSSProperties } from "react";
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
};

export function MainRoom({ profile, characterState, words, latestDiary, turn, onAction, onSeedSampleWords }: MainRoomProps) {
  const name = characterState?.character_name ?? "アグリちゃん";
  const playerName = profile?.player_name ?? "あなた";
  const backgroundImage = `${import.meta.env.BASE_URL}assets/backgrounds/aguri_room_desk.webp`;
  const roomStyle = {
    backgroundImage: `linear-gradient(180deg, rgba(255, 250, 242, 0.03), rgba(47, 33, 23, 0.08)), url("${backgroundImage}")`
  } as CSSProperties;

  return (
    <main className="screen main-room-screen">
      <section className="aguri-room" style={roomStyle}>
        <header className="room-header">
          <strong>{playerName}の部屋</strong>
          <span>言葉 {words.length}こ</span>
          <button type="button" onClick={() => onAction("settings")}>設定</button>
        </header>

        <div className="room-stage">
          <CharacterStage name={name} expression={turn.expression} wordCount={words.length} />
          <DialogueBox speaker={name} text={turn.text} variant="bubble" />
        </div>

        {words.length === 0 && (
          <section className="sample-word-note" aria-label="おためし用単語">
            <strong>まず会話を試したい時</strong>
            <span>おためし用の言葉を入れると、会話と日記の動きをすぐ見られます。</span>
            <button type="button" onClick={onSeedSampleWords}>おためし単語を100こ入れる</button>
          </section>
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
