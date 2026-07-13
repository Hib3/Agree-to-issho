# アグリといっしょ

オリジナル少女キャラクター「アグリちゃん」に言葉を教え、その言葉を後の会話や日記で使う、完全オフライン対応のPWAです。

公開URL: https://hib3.github.io/Agree-to-issho/

## Clean-room v1

`rewrite/cleanroom-v1` は、旧ランタイムを流用せずに作り直した再構築版です。

- ユーザーが教えた言葉を `Concept` として保存
- 大分類、詳細分類、カテゴリごとの2〜4個の意味属性、好み、任意の読み方を質問
- 人物の呼び方・関係や、物の用途・目的などを会話用の型付き記憶として保持
- 文法役割とカテゴリが一致するスロットだけへ言葉を配置
- 型付き記憶を導入・展開・転換・オチからなる小話へ反映
- 5種の進行、8種の転換、10種のオチを組み合わせた400通りの小話構成
- 未確認の組合せは事実として断定せず、仮定または想像として発話
- 回答で言葉同士の関係を強化、訂正、保留
- 使用回数と直近会話による連続使用の抑制
- 会話途中、質問待ち、学習途中をIndexedDBへ保存
- 実会話と記憶をもとに日記を生成
- 設定でRSSニュースを有効化し、保存した見出しをアグリちゃんが根拠を限定して説明
- 会話開始、ページ送り、決定に連動する短い効果音と、実際に機能する音量・ミュート設定
- JSONバックアップ、検証、置換・統合、旧DBの明示的な読込
- 20〜60秒の自発会話。回答中、入力中、非表示時などは停止

初期データはすべて本作向けの一般的なオリジナルデータです。

- 基礎概念: 320
- 会話テンプレート: 79
- 小話構成: 400
- 学習導入文: 100
- 返答パターン: 160
- 日記テンプレート: 60
- 記憶呼び出しテンプレート: 60
- 場所: 3
- 初回シナリオ: 5

## Character

表示するキャラクターは、ユーザー提供画像を正とする人間の少女「アグリちゃん」です。

- 承認済み通常立ち絵: `public/assets/characters/main/fullbody/approved/aguri_normal.png`
- 承認済み差分: 通常会話、まばたき、喜び、驚き、照れ、寂しさ、得意げ、考え中、困惑、眠気
- 感情と発話状態に応じて1体の立ち絵を切り替え、CSSの小さな動きを重ねます。
- 生成失敗画像、未承認画像、原作画像は公開領域へ置きません。
- 発話は全てアグリちゃん用の口調レイヤーを通します。学習語や否定・疑問の意味を残しながら、高いテンションと崩し敬語を適用します。

背景は本作向けに生成・検査した部屋の日中・夕方・夜・雨、商店街、屋上を使用します。会話紙、選択紙、主ボタン布も専用生成テクスチャです。追加素材のグリーン背景除去は `tools/assets/prepare_hibiki_assets.py` で再現でき、元画像を公開領域やGitへ入れず、検査済みの変換結果だけを使用します。

## Development

```powershell
npm install
npm run dev
```

公開前の確認:

```powershell
npm run lint
npm run typecheck
npm run validate:data
npm run verify:cleanroom
npm run verify:pwa
npm run test:dialogue
npm run test
npm run simulate:dialogue
npm run build
npm run test:e2e
```

## Storage

- 正本: IndexedDB `aguri-cleanroom-v1`
- 旧DB `with-agree-db` は変更しません。
- 旧データの読込はプレビューとユーザー確認後にだけ実行します。
- JSON読込は形式、`appId`、schema version、checksumを検証します。
- 読込前に現在のデータを自動バックアップします。
- RSSから保存するのは見出し、短い説明、出典URL、日時です。記事全文は保存しません。

## ニュース機能

設定の「ニュース機能を使う」を有効にして、公開HTTPSのRSS URLを登録します。更新間隔は15分、30分、1時間、3時間から選べ、アプリを開いている間とオンラインへ戻った時に確認します。アプリを閉じている間のバックグラウンド更新は行いません。

- まずブラウザからRSSを直接取得します。
- 配信元のCORS設定により直接取得できない場合があります。
- 任意の「取得補助」を有効にした場合だけ、登録したRSS URLを `rss2json.com` へ送信します。
- アグリちゃんは見出しとRSS内の短い説明だけを扱い、背景や真偽を知っているとは発言しません。
- ニュース更新には通信が必要です。保存済みの見出しはオフラインでも確認できます。
- ニュースキャッシュは端末内データであり、JSONバックアップには含めません。

## PWA / GitHub Pages

Viteのbase pathは環境変数で変更できます。

```powershell
$env:VITE_BASE_PATH="/Agree-to-issho/"
npm run build
```

`main` または `rewrite/cleanroom-v1` へのpushで `.github/workflows/pages.yml` が型検査、テスト、ビルドを実行し、GitHub Pagesへ配信します。アプリ内ルーティングはURLを変更しないため、再読込で個別パスの404は発生しません。

オフライン確認:

1. `npm run build`
2. `npm run preview`
3. 一度オンラインで開き、Service Workerの登録完了を待つ
4. DevToolsでOfflineへ切り替える
5. 再読込後に会話、学習、単語帳、日記、バックアップを確認する

## Evidence Boundary

プレイ動画やファン資料から使うのは、次の抽象的な観察だけです。

- 状況に沿って言葉を尋ねる
- 大分類から追加質問へ進む
- 教えた言葉を後の短い複数ページ会話で再利用する
- 一箇所だけ関係を取り違える余地を残し、ユーザーが訂正できる
- キャラクターが自発的に話し始める

今回の動画確認で分けた「確認済み」「推測」「不明」と実装受入条件は、`docs/rebuild/video-observation-implementation-contract.json` に記録しています。動画フレームや文字起こしは保存していません。

既存IPのキャラクター、名称、画像、音声、台詞、辞書、質問文、イベント、UI、データは実装・配布しません。調査用動画、PS1データ、抽出物、口調調査JSONもGitへ保存しません。不明な原作内部仕様を「確認済み」とは扱いません。

## Repository Hygiene

次の内容はGit管理外です。

- `node_modules/`, `dist/`, `.playwright-cli/`
- `research_private/`, `docs/research/generated/`
- `dokodemo/`, `doko-demo-issyo/`
- `*.bin`, `*.iso`, `*.cue`, `*.img`, `*.sub`, `*.ccd`, `*.chd`
- 調査用JSON、動画、抽出画像、抽出音声、大量文字列dump

再構築前の状態は `archive/pre-zero-rebuild-20260712` ブランチと `pre-zero-rebuild-20260712` タグへ保存しています。
