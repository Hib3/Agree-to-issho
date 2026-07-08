type ManualScreenProps = {
  onBack: () => void;
};

export function ManualScreen({ onBack }: ManualScreenProps) {
  return (
    <main className="screen narrow-screen">
      <div className="topbar">
        <h1>説明</h1>
        <button type="button" onClick={onBack}>戻る</button>
      </div>
      <section className="panel prose">
        <p>このMVPは、あなたが入力したオリジナルの言葉だけをこの端末の中へ保存します。</p>
        <p>種類、気持ち、思い出す場面を少しずつ聞き、会話に出しすぎないように調整します。</p>
        <p>ブロックした言葉は通常会話には出しません。外部サーバーやAPIキーは使いません。</p>
      </section>
    </main>
  );
}
