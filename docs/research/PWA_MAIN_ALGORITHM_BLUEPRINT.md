# PWA Main Algorithm Blueprint

## Status

これは、現時点でPWA実装に使う中核アルゴリズムの入口。

優先根拠:

- `docs/research/PWA_CORE_ALGORITHM_CONTRACT.md`
- `docs/research/PWA_LEARNING_SPEAKING_STATE_MACHINE.md`
- `docs/research/SAVE_LOAD_MEMORY_FLOW.md`
- `docs/research/SPEECH_SLOT_MODEL.md`
- `docs/research/PWA_ALGORITHM_TRACEABILITY.md`

旧ドラフトや広域モデルより、この文書を優先する。

## Confirmed Functional Shape

確認済み:

- ユーザーが言葉を教える。
- 教えた言葉について追加質問が行われる。
- 覚えた言葉が後の会話で使われる。
- entry `1` に `WORD/QUEST/ANS` 系構造ラベルがある。
- `WORD/QUEST`領域と`ANS`領域は別に参照される。
- `%s`参照関数と学習関連領域参照関数には構造的な近接がある。
- `LOAD`候補と記憶/同期系候補があり、保存状態を復元する境界をPWA側で分ける根拠になる。

不明:

- 原作の質問文。
- 原作の単語カテゴリ。
- 原作の発話テンプレート。
- 原作の学習語選択重み。
- 原作のセーブデータ構造。
- `%s` がユーザー学習語を受け取るかどうか。

## Runtime Loop

```text
boot
  -> loadLearningSave(raw)
  -> validateLearningSave(raw)
  -> restoreLearningRuntime(save)
  -> rebuildLearnedWordIndexes(learnedWords)
  -> idle

idle
  -> user teaches word
  -> learnWord(input)
  -> chooseLearningQuestion(draft)
  -> awaiting_learning_answer

awaiting_learning_answer
  -> applyLearningAnswer(answer)
  -> finalizeLearnedWord(draft)
  -> persistLearningSave(runtime)
  -> idle

idle
  -> chooseSpeechSlot(context)
  -> pickWordForSpeech(slot, learnedWords)
  -> renderSpeech(slot, word?)
  -> recordWordUse(word?)
  -> persistLearningSave(runtime)
  -> idle
```

## Data Model

最小実装:

```ts
type LearnedWord = {
  id: string;
  surface: string;
  normalized: string;
  meaningKind: "person" | "place" | "thing" | "action" | "feeling" | "time" | "unknown";
  preference: "like" | "neutral" | "dislike" | "unknown";
  learnedAt: string;
  lastUsedAt?: string;
  usageCount: number;
};

type LearnedWordDraft = {
  surface: string;
  normalized: string;
  answers: LearningAnswer[];
  createdAt: string;
};

type LearningSave = {
  schemaVersion: number;
  learnedWords: LearnedWord[];
  pendingLearning?: {
    draftWord: LearnedWordDraft;
    pendingQuestion: LearningQuestion;
  };
  updatedAt: string;
};
```

注意:

- `meaningKind`, `preference`, `usageCount`, `lastUsedAt` は原作確認済みフィールドではない。
- これらは、学習質問と後続発言を成立させるPWA側の最小近似。
- 原作カテゴリ名、原作質問文、原作会話文は使わない。

## Learning Algorithm

```text
learnWord(input)
  1. reject empty or too-long input
  2. store exact surface
  3. compute normalized
  4. find existing learned word by normalized
  5. if existing, enter review/update path
  6. otherwise create draft
  7. choose one original PWA learning question
  8. persist pendingLearning
```

```text
applyLearningAnswer(answer)
  1. require pendingLearning
  2. validate answer against pendingQuestion
  3. append answer to draft
  4. if minimum required answers are complete, finalize
  5. else choose next original PWA question
  6. persist pendingLearning or learnedWords
```

Required:

- 新語は、少なくとも1つの追加質問に回答されるまで学習済みにしない。
- `chooseLearningQuestion()` と `applyLearningAnswer()` を結合しない。
- 回答を直接発話に使わず、いったん単語属性へ反映する。

## Speaking Algorithm

```text
speak(context)
  1. choose original PWA speech slot
  2. find learned words compatible with slot.kind
  3. avoid recently used words when possible
  4. prefer lower usageCount
  5. tie-break by learnedAt then id
  6. render original line with zero or one learned word
  7. update usageCount and lastUsedAt only if a word was used
```

Required:

- 1発話につき学習語は最大1語。
- 候補語がない場合は、学習語なしのオリジナル文を出す。
- 原作テンプレート、原作口調、原作台詞は使わない。
- `usageCount`, `lastUsedAt`, `cooldown` はPWA側の反復防止であり、原作重みではない。

## Save/Load Algorithm

```text
loadLearningSave(raw)
  -> read from IndexedDB/local file/imported JSON

validateLearningSave(raw)
  -> schemaVersion exists
  -> learnedWords is array
  -> every learned word has surface and normalized
  -> pendingLearning, if present, has draftWord and pendingQuestion
  -> reject original assets, extracted text arrays, binary dumps

restoreLearningRuntime(save)
  -> learnedWords
  -> pendingLearning
  -> runtime state

rebuildLearnedWordIndexes(words)
  -> by normalized
  -> by meaningKind
```

Required:

- 保存形式はPWA独自JSON。
- 原作メモリカード形式は再現しない。
- import/exportはユーザー作成学習データだけを扱う。
- `docs/research/generated/*.json` をゲームセーブとして使わない。

## Implementation Tests

必須テスト:

- 空入力は学習draftを作らない。
- 新語入力で `pendingLearning` が作られる。
- 追加質問に答えるまで `learnedWords` に入らない。
- 回答後に学習語が1件だけ追加される。
- 同じ `normalized` の語を重複追加しない。
- reload後に `pendingLearning` が復元される。
- 発話候補がない場合、学習語なしで発話する。
- 発話候補がある場合、最大1語だけ挿入する。
- 発話後に `usageCount` と `lastUsedAt` だけを更新する。
- export JSONに原作データ、抽出テキスト、研究JSONが入らない。
- import JSONは検証に失敗したらmergeしない。

## Forbidden

- 原作会話文を使う。
- 原作質問文を使う。
- 原作辞書を使う。
- 原作キャラ設定や口調を再現する。
- 原作カテゴリや重みを確認済みとして扱う。
- `%s` が学習語専用だと断定する。
- 原作メモリカード形式を復元済みとして扱う。
- 研究用生成JSONをPWAのゲームデータに混ぜる。
