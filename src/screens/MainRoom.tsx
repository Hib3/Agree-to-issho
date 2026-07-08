import { CharacterStage } from "../components/character/CharacterStage";
import { DialogueBox } from "../components/DialogueBox";
import type { AppProfile, CharacterState, DiaryEntry, DialogueTurn, WordFrame } from "../types/domain";

type RoomAction = "speak" | "teach" | "wordbook" | "diary" | "settings" | "import-export" | "manual" | "title";

type MainRoomProps = {
  profile: AppProfile | null;
  characterState: CharacterState | null;
  words: WordFrame[];
  latestDiary?: DiaryEntry;
  turn: DialogueTurn;
  onAction: (action: RoomAction) => void;
};

export function MainRoom({ profile, characterState, words, latestDiary, turn, onAction }: MainRoomProps) {
  const name = characterState?.character_name ?? "アグリちゃん";
  const playerName = profile?.player_name ?? "あなた";

  return (
    <main className="screen main-room-screen">
      <section className="room-scene">
        <div className="room-ui-top">
          <span>{playerName}の部屋</span>
          <span>覚えた言葉 {words.length}こ</span>
          <button type="button" onClick={() => onAction("settings")}>設定</button>
        </div>

        <div className="room-stage-wrap">
          <CharacterStage name={name} expression={turn.expression} wordCount={words.length} />
          <DialogueBox speaker={name} text={turn.text} variant="bubble" />
        </div>

        <div className="main-command-panel" aria-label="メイン操作">
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

      <nav className="sub-command-strip" aria-label="サブメニュー">
        <button type="button" onClick={() => onAction("wordbook")}>単語帳</button>
        <button type="button" onClick={() => onAction("diary")}>日記</button>
        <button type="button" onClick={() => onAction("import-export")}>保存</button>
        <button type="button" onClick={() => onAction("manual")}>説明</button>
        <button type="button" onClick={() => onAction("title")}>タイトル</button>
      </nav>
    </main>
  );
}
