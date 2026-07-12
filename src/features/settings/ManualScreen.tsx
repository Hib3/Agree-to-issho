import { ScreenHeader } from "../../ui/components/ScreenHeader";

export function ManualScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="feature-screen manual-screen">
      <ScreenHeader title="この部屋について" onBack={onBack} />
      <section className="paper-panel">
        <h2>言葉を教える</h2>
        <p>短い言葉を入力し、あなたが思う種類や気持ちを答えます。現実と違う分類でも、アグリちゃんは勝手に訂正しません。</p>
        <h2>話す</h2>
        <p>教えた言葉と最初から知っている生活語を組み合わせて、短い会話を作ります。返事によって言葉同士のつながりが変わります。</p>
        <h2>保存</h2>
        <p>記憶はこの端末の中へ保存されます。JSONファイルでバックアップと復元ができます。</p>
        <h2>オフライン</h2>
        <p>一度読み込んだ後は、ネットがなくても会話、学習、日記、保存を利用できます。</p>
        <p className="cleanroom-note">この作品はオリジナルのファンメイド会話ゲームです。既存作品のキャラクター、台詞、画像、辞書、イベント、UIは使用していません。</p>
      </section>
    </main>
  );
}
