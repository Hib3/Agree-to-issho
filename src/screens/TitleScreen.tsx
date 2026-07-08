import { getFallbackCharacterImagePath } from "../data/initial/assetManifest";

type TitleScreenProps = {
  hasStarted: boolean;
  wordCount: number;
  onStart: () => void;
  onContinue: () => void;
  onManual: () => void;
  onSaveData: () => void;
};

export function TitleScreen({ hasStarted, wordCount, onStart, onContinue, onManual, onSaveData }: TitleScreenProps) {
  const characterImage = `${import.meta.env.BASE_URL}${getFallbackCharacterImagePath()}`;

  return (
    <main className="screen title-screen">
      <section className="title-room-scene">
        <div className="title-room-decor" aria-hidden="true">
          <div className="title-window" />
          <div className="title-desk" />
          <div className="title-memo-paper" />
        </div>

        <div className="title-plate">
          <h1>With Aguri</h1>
          <p>言葉を教える小さな部屋</p>
        </div>

        <div className="title-character">
          <img src={characterImage} alt="アグリちゃん" />
        </div>

        <aside className="title-memo">
          <strong>部屋のメモ</strong>
          {hasStarted ? <span>覚えた言葉 {wordCount}こ</span> : <span>まだ保存された部屋はありません</span>}
        </aside>

        <div className="title-copy">
          <p>アグリちゃんは、あなたが教えた言葉だけを少しずつ覚えます。</p>
          <p>保存はこの端末の中だけ。ネットがなくても遊べます。</p>
        </div>

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
