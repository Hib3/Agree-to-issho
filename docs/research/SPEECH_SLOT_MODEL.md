# Speech Slot Model

## Scope

対象はPWAのメイン機能である、覚えた言葉を発言に使う処理。

対象外:

- 原作会話文の復元。
- 原作テンプレートの復元。
- 原作キャラクター口調の再現。
- 原作の単語選択重みの断定。

## Confirmed Evidence

- entry `1` には `%s` が42件ある。
- そのうち18件はMIPSコードから参照される。
- `%s`参照関数候補は9件ある。
- `WORD/QUEST`領域参照関数は20件、`ANS`領域参照関数は10件ある。
- `%s`参照関数と学習関連領域参照関数の重なりは2件ある。
- `%s`参照関数と学習関連領域参照関数には直接リンク1件がある。
- `%s`参照関数と学習関連領域参照関数には共通呼び先21件がある。
- 解析結果は `docs/research/generated/speech_slot_links.json` に保存されるが、Git ignore対象。

## Unknown

- `%s` がユーザー学習語を受け取るかは不明。
- `%s` がUI、デバッグ、日付、名前、内部ラベルのどれに使われるかは不明。
- 原作の発話テンプレート選択ロジックは不明。
- 原作の学習語選択重みは不明。

## Inference

- 推測: entry `1` には、学習系の状態/表示領域と、文字列スロット整形処理が近い位置または呼び出し関係にある可能性がある。
- 推測: PWAで「覚えた言葉をオリジナル文の安全なスロットへ1語だけ入れる」設計は、原作機能から大きく外れにくい。
- 推測: ただし、原作の文面、口調、テンプレート、重みは使わず、PWA独自にする必要がある。

## PWA Contract

```ts
function chooseSpeechSlot(context: TalkContext): SpeechSlot;
function pickWordForSpeech(slot: SpeechSlot, words: LearnedWord[]): LearnedWord | null;
function renderSpeech(slot: SpeechSlot, word: LearnedWord | null): string;
function recordWordUse(word: LearnedWord, now: string): LearnedWord;
```

Required behavior:

- `chooseSpeechSlot()` はPWAオリジナル文だけを選ぶ。
- `pickWordForSpeech()` はslotの種類に合う学習語だけを候補にする。
- `pickWordForSpeech()` は候補がなければ `null` を返す。
- `renderSpeech()` は1発話につき学習語を最大1語だけ挿入する。
- `recordWordUse()` はPWA側メタデータだけを更新する。

## Minimal Selection Rule

原作重みは不明なので、PWAでは単純でテスト可能な規則にする。

```text
candidate words
  -> filter by slot.kind
  -> filter out recently used words when possible
  -> prefer lower usageCount
  -> stable tie-break by learnedAt then id
```

Notes:

- `usageCount`, `lastUsedAt`, `cooldown` は原作確認済みフィールドではない。
- これらは、同じ語を連発しないためのPWA側近似。
- 原作と同じランダム性、重み、カテゴリとは呼ばない。
