import { getFallbackCharacterImagePath } from "../data/initial/assetManifest";
import type { CSSProperties } from "react";

type TitleScreenProps = {
  hasStarted: boolean;
  wordCount: number;
  onStart: () => void;
  onContinue: () => void;
  onManual: () => void;
  onSaveData: () => void;
  onSeedSampleWords: () => Promise<number>;
};

export function TitleScreen({ hasStarted, wordCount, onStart, onContinue, onManual, onSaveData, onSeedSampleWords }: TitleScreenProps) {
  const characterImage = `${import.meta.env.BASE_URL}${getFallbackCharacterImagePath()}`;
  const backgroundImage = `${import.meta.env.BASE_URL}assets/backgrounds/aguri_room_desk.webp`;
  const roomStyle = {
    backgroundImage: `linear-gradient(180deg, rgba(255, 250, 242, 0.04), rgba(57, 36, 22, 0.08)), url("${backgroundImage}")`
  } as CSSProperties;

  return (
    <main className="screen title-screen">
      <section className="title-room" style={roomStyle}>
        <header className="title-plate">
          <h1>アグリといっしょ</h1>
          <p>言葉を教える小さな部屋</p>
        </header>

        <div className="title-character">
          <img src={characterImage} alt="アグリちゃん" />
        </div>

        <aside className="title-memo">
          <strong>部屋のメモ</strong>
          {hasStarted ? <span>覚えた言葉 {wordCount}こ</span> : <span>まだ保存された部屋はありません</span>}
          {hasStarted && wordCount === 0 && (
            <button type="button" className="memo-button" onClick={onSeedSampleWords}>
              おためし用単語を入れる
            </button>
          )}
        </aside>

        <section className="title-copy">
          <p>アグリちゃんは、あなたが教えた言葉だけを少しずつ覚えます。</p>
          <p>保存はこの端末の中だけ。ネットがなくても遊べます。</p>
        </section>

        <div className="title-actions">
          <button className="primary" type="button" disabled={!hasStarted} onClick={onContinue}>つづきから</button>
          <button type="button" onClick={onStart}>はじめから</button>
        </div>
        <div className="title-actions secondary-actions">
          <button type="button" onClick={onManual}>説明</button>
          <button type="button" onClick={onSaveData}>保存データ</button>
        </div>
      </section>
    </main>
  );
}
