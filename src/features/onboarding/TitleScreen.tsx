import { CharacterStage } from "../../ui/components/CharacterStage";

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
          <p className="title-kicker">小さな言葉の部屋</p>
          <h1>アグリといっしょ</h1>
          <p>あなたが教えた意味を、アグリちゃんが少しずつ自分の会話へつなげます。</p>
        </div>
        <CharacterStage emotion="happy" locationId="room" />
        <aside className="title-note">
          <strong>部屋のメモ</strong>
          <span>{hasSave ? `教えた言葉 ${userWordCount}こ` : "まだ最初のページです"}</span>
        </aside>
        <div className="title-actions">
          <button className="primary" type="button" disabled={!hasSave} onClick={onContinue}>つづきから</button>
          <button type="button" onClick={onStart}>はじめから</button>
          <button className="quiet" type="button" onClick={onManual}>説明</button>
          <button className="quiet" type="button" onClick={onBackup}>保存データ</button>
        </div>
      </section>
    </main>
  );
}
