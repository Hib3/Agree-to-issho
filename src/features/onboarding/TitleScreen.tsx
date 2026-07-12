import { CharacterStage } from "../../ui/components/CharacterStage";
import { ArchiveRestore, BookOpen, DoorOpen, HelpCircle, Sparkles } from "lucide-react";

export function TitleScreen({ hasSave, userWordCount, onContinue, onStart, onManual, onBackup }: {
  hasSave: boolean;
  userWordCount: number;
  onContinue: () => void;
  onStart: () => void;
  onManual: () => void;
  onBackup: () => void;
}) {
  return (
    <main className="title-screen">
      <section className="title-room">
        <div className="title-copy">
          <p className="title-kicker">言葉を教える小さな部屋</p>
          <h1>アグリといっしょ</h1>
          <p>教えた言葉が、少しずつアグリちゃんの話になります。</p>
        </div>
        <CharacterStage emotion="happy" locationId="room" timeOfDay="day" isSpeaking />
        <aside className="title-note">
          <strong><BookOpen size={17} aria-hidden="true" /> 部屋のメモ</strong>
          <span>{hasSave ? `教えた言葉 ${userWordCount}こ` : "まだ最初のページです"}</span>
        </aside>
        <div className="title-actions">
          <button className="primary title-enter" type="button" disabled={!hasSave} onClick={onContinue}><DoorOpen aria-hidden="true" />つづきから</button>
          <button type="button" onClick={onStart}><Sparkles aria-hidden="true" />はじめから</button>
          <button className="quiet" type="button" onClick={onManual}><HelpCircle aria-hidden="true" />説明</button>
          <button className="quiet" type="button" onClick={onBackup}><ArchiveRestore aria-hidden="true" />保存データ</button>
        </div>
      </section>
    </main>
  );
}
