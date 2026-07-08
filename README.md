# With Aguri

React + TypeScript + Viteで作る、完全オフライン対応のファンメイド会話ゲームMVPです。メインキャラクターはユーザー提供画像のオリジナル人間少女キャラクター「アグリちゃん」です。

既存IPのキャラクター、名称、ロゴ、画像、音声、台詞、辞書、イベント、固有設定は含めません。使うのは「ユーザーが言葉を教え、キャラクターが意味を質問で覚え、会話や日記へ再利用する」という抽象システムだけです。

## Development

```powershell
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

## Review Zip

`node_modules/`, `dist/`, PS1データ、未承認/却下素材を含めない確認用zipを作る場合:

```powershell
npm run zip:review
```

## MVP

- TitleScreen / FirstStartWizard / MainRoom
- CharacterStage / DialogueBox / ChoiceButtons / TextInputPanel
- TeachWordFlow / WordCategorySelector / MeaningQuestionFlow
- WordbookScreen / DiaryScreen / SettingsScreen / ImportExportScreen
- StorageStatusPanel / ManualScreen / DebugPanel
- 保存先: この端末の中のIndexedDB
- JSON backup/import: `app_id=aguri-word-room`, checksum, preview, backup, replace/merge
- Service Worker + Web App Manifest
- Approved standing art: `public/assets/characters/main/fullbody/approved/aguri_normal.png`

## Research Boundary

`docs/research/` の調査資料は補助情報です。公式仕様ではありません。
PWA実装に使うのは、キャラクター中心の会話、単語学習、日記/イベントの抽象設計ヒントだけです。
既存IPのキャラクター名、種族、デザイン、画像、ロゴ、スクリーンショット、UI文言、イベント名、Wiki本文、原作辞書、原作質問文はコードやデータへ入れません。

## GitHub Pages

`vite.config.ts` は `VITE_BASE_PATH` でbase pathを変更できます。

```powershell
$env:VITE_BASE_PATH="/Agree-to-issho/"
npm run build
```

Pagesのreload 404対策は、GitHub Pages側でSPA fallbackがない点に注意してください。このMVPはHash Routerを使わず単一画面状態で動くため、公開URLの入口は `index.html` にしてください。

## Offline Check

1. `npm run build`
2. `npm run preview`
3. ブラウザで一度開き、Service Worker登録を待つ
4. DevToolsのNetworkでOfflineにする
5. reload後、タイトル、会話、単語保存、単語帳、backup/importが動くことを確認する

IndexedDBの永続化は `navigator.storage.persist()` を試します。状態は設定画面のStorageStatusPanelで確認できます。

## Clean-room Rules

- 原作データ、抽出画像、抽出音声、抽出テキスト全文をcommitしない
- 原作の会話文、辞書、キャラ設定、画像、音声、UI文言を実装に使わない
- キャラクターはユーザー提供画像を正とし、実装側で別デザインを作らない
- `dokodemo/`, `doko-demo-issyo/`, `research_private/`, `docs/research/generated/`, PS1イメージファイルはcommit対象にしない
- 実装はオリジナルPWAとして、この端末の中にあるユーザー作成データだけを保存・出力する
- `node_modules/` と `dist/` はgit管理・review zip共有しない

## Character Assets

- `approved/aguri_normal.png` を現在唯一のゲーム表示用素材にします。
- 表情差分は正式素材が揃うまで表示しません。
- Runtimeの `public/` には承認済み素材だけを置きます。
- 未承認、却下、生成プロンプト、失敗シート、PS1データ、研究用ファイルは `public/` に置きません。
- 正式素材は透明PNG、全身立ち絵、同一画角、同一余白、同一位置で作ります。
- 白背景、除去漏れ、ドット欠け、不要アーティファクト、分裂、浮遊パーツがある画像は正式版では使いません。
- 詳細は `docs/assets/aguri_asset_spec.md` と `docs/assets/aguri_asset_review_checklist.md` を参照します。
