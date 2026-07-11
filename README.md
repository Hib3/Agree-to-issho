# アグリといっしょ

https://hib3.github.io/Agree-to-issho/

React + TypeScript + Viteで作る、完全オフライン対応のファンメイド会話ゲームです。メインキャラクターはユーザー提供画像のオリジナル人間少女キャラクター「アグリちゃん」です。

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
- StorageStatusPanel / ManualScreen / おためし準備パネル
- 保存先: この端末の中のIndexedDB
- JSON backup/import: `app_id=aguri-word-room`, checksum, preview, backup, replace/merge
- Service Worker + Web App Manifest
- Approved standing art: `public/assets/characters/main/fullbody/approved/aguri_normal.png`
- Original room background: `public/assets/backgrounds/aguri_room_desk.webp`

## UI Direction

- 画面は「アグリちゃんの小さな机の部屋」を基準にします。
- 木の机、ノート、付箋、やわらかい紙色を中心にし、紫はアクセントに留めます。
- MainRoomは、背景、立ち絵、会話吹き出し、主ボタンを一体の部屋シーンとして扱います。
- `話す` と `言葉を教える` を主導線にし、単語帳、日記、保存、説明、タイトルは付箋風の補助操作にします。
- 会話欄は日本語の折返しと行間を優先し、`onNext` がない時は `▼` を表示しません。

## Sample Words

- 単語が0この時は、部屋画面とタイトルのメモに `おためし単語を100こ入れる` ボタンを表示します。
- おためし単語は汎用的な日常語だけで、既存IPの辞書や固有語は含みません。
- 追加された単語はこの端末の保存領域に入り、会話、単語帳、日記の動作確認に使えます。
- 設定で補助パネルを表示している場合も、同じおためし単語投入ボタンを使えます。

## Learning System

- `話す` は、単語数、直近会話、低理解語、時間帯、日記有無を見て発話状態を選びます。
- 単語には、わかった度、記憶、気に入り度、曖昧さ、ズレ度、復習回数を持たせています。
- 低理解または曖昧な言葉は、復習候補として部屋画面と単語帳から見直せます。
- 単語帳では、読み、種類、気持ち、場面、メモを直しながら復習できます。
- ズレた使い方をした時は、部屋画面で修正メモを書いて `直す` / `そのままでいい` を選べます。
- 日記は、今日の会話ログ、使った言葉、ズレ、修正、復習の情報を優先して生成し、出てきた言葉をチップで表示します。
- 10語以上ある時、単語帳に読みがつながる `しりとり候補` を軽く表示します。
- これらは原作仕様の断定ではなく、このPWA用の抽象的な学習会話モデルです。

## Conversation System v2

- 通常会話は `opening → awaiting_answer → reaction → closing → completed` の短いセッションとして、この端末の中へ保存します。
- 質問は好き嫌い、意味の再確認、場面、関連語を扱い、選択回答または60文字以内の短いメモをWordFrameへ反映します。
- 回答待ちの途中で再読み込みしても、保存済みConversationSessionとDialogueLogから質問へ戻ります。
- 状態、テンプレート、単語は注入可能な乱数による重み付き抽選です。直近のspeech act、意味キー、テンプレート、単語、カテゴリにはcooldownをかけます。
- アグリちゃんの口調層は、完成済み本文の単語、否定、疑問を保ったまま、導入または語尾を一部だけ調整します。
- 自動発話は90〜180秒の範囲で待ち、回答待ち、別画面、非表示タブ、保存処理中には実行しません。
- `last_user_interaction_at` と `last_character_speech_at` を分離し、留守判定はユーザー操作を基準にします。
- 日記は当日の実会話、回答、復習、修正、関連語を優先し、原則1日1件です。

## Save Compatibility

- IndexedDBはversion 3です。`conversation_sessions` storeを追加しています。
- JSON save schemaはversion 3です。会話ログと会話セッションを含みます。
- schema 1 / 2は読み込み時に不足フィールドを補完します。
- merge時はDialogueLogとConversationSessionをIDで重複保存しません。

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

## Background Assets

- `public/assets/backgrounds/aguri_room_desk.webp` / `.png` は、アグリちゃんの小さな机の部屋として作成したオリジナル背景素材です。
- 人物、キャラクター、ロゴ、UI、読める文字は含めません。
- 既存IPや原作画像は使用していません。
- アグリちゃん本体は背景へ生成せず、承認済み通常立ち絵だけを重ねて表示します。
