# PWA Core Algorithm Contract

## Scope

対象はメイン機能だけ。

- ユーザーの言葉を覚える。
- 覚えた言葉について質問する。
- 回答を学習状態へ反映する。
- 覚えた言葉を発話に使う。
- 学習データをimport/exportできる形に保つ。

対象外:

- 日記
- PocketStation相当の携帯モード
- ミニゲーム
- 原作イベント
- 原作キャラ設定
- 原作会話文

## Evidence-Based Constraints

確認済み:

- entry `1` に `WORD/QUEST/ANS` 系構造ラベルがある。
- `WORD/QUEST` を含むテキスト領域はMIPSコードから90回参照される。
- `ANS` を含む別テキスト領域はMIPSコードから34回参照される。
- `WORD/QUEST`参照関数群と`ANS`参照関数群は共有関数0件。
- 両者には直接リンク5件と共通呼び先9件がある。
- entry `1` 内の `%s` の一部はMIPSコードから参照される。

Evidence counts:

- `shared_function_count=0`
- `direct_links=5`
- `common_callees=9`

解釈:

- 質問を作る処理と回答を適用する処理は、同一関数ではなく連携する別責務として扱う。
- 発話はスロット式整形を使ってよい。
- ただし `%s` がユーザー学習語専用かは不明。

## Required PWA Flow

```text
learnWord(input)
  -> normalize input
  -> check duplicate
  -> create draft word
  -> chooseLearningQuestion(draft)
  -> wait for answer

applyLearningAnswer(answer)
  -> validate pending question
  -> attach answer to draft word
  -> if more required questions exist, choose next question
  -> otherwise finalize learned word

speak()
  -> choose original utterance slot
  -> select one compatible learned word
  -> render original utterance with one slot
  -> update usage metadata
```

## Required Separation

```ts
function chooseLearningQuestion(draft: LearnedWordDraft, state: LearningState): LearningQuestion;
function applyLearningAnswer(answer: LearningAnswer, state: LearningState): LearningState;
function finalizeLearnedWord(draft: LearnedWordDraft): LearnedWord;
function chooseSpeechSlot(context: TalkContext): SpeechSlot;
function pickWordForSpeech(slot: SpeechSlot, words: LearnedWord[]): LearnedWord | null;
function renderSpeech(slot: SpeechSlot, word: LearnedWord | null): string;
```

Do not merge `chooseLearningQuestion()` and `applyLearningAnswer()` into one opaque function.
They correspond to separate evidence regions and should remain independently testable.

See `docs/research/PWA_ALGORITHM_TRACEABILITY.md` for the evidence basis of each function.
See `docs/research/PWA_LEARNING_SPEAKING_STATE_MACHINE.md` for required states, transitions, and import/export validation.
See `docs/research/SAVE_LOAD_MEMORY_FLOW.md` for save/load restoration boundaries.
See `docs/research/SPEECH_SLOT_MODEL.md` for learned-word speech slot selection.
See `docs/research/PWA_MAIN_ALGORITHM_BLUEPRINT.md` for the integrated implementation loop.

## Minimal Data Shape

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
```

These fields are not confirmed original fields.
They are the minimum PWA fields needed to support the confirmed functional loop.

## Speaking Rules

- Use one learned word per utterance.
- Use only original PWA utterance text.
- Do not imitate original character style.
- Do not use original templates.
- Match word kind to slot kind.
- If no compatible word exists, speak without a learned word.
- Prefer simple, testable word selection over claimed original weighting.
- Treat `usageCount`, `lastUsedAt`, and `cooldown` as PWA-only repetition controls.

## Learning Rules

- Store the exact user-provided surface form.
- Store a normalized form for duplicate checks.
- Ask at least one classification question before finalizing a new word.
- Keep pending question state until answered.
- If the user teaches the same normalized word again, review or update it instead of duplicating it.

## Import/Export Requirement

The PWA save file must be self-contained JSON:

```ts
type ExportData = {
  schemaVersion: number;
  learnedWords: LearnedWord[];
  pendingLearning?: {
    draftWord: LearnedWordDraft;
    pendingQuestion: LearningQuestion;
  };
  exportedAt: string;
};
```

Never export:

- original disc data
- extracted text
- extracted assets
- original conversation templates
- original dictionaries

## Save/Load Rules

- Load persistent JSON before starting conversation.
- Validate `schemaVersion`, `learnedWords`, and `pendingLearning` before use.
- Restore unanswered learning questions after reload.
- Rebuild runtime-only word indexes after load.
- Keep save/load separate from speech rendering.
- Do not copy the original memory-card binary format.

## Explicit Non-Claims

- This is not a clone of the original internal algorithm.
- This does not reproduce original word categories.
- This does not reproduce original question text.
- This does not prove `%s` is used for learned user words.
- This does not prove original learned-word selection weights.
- This does not prove the original answer save format.
- This does not prove the original memory-card field layout.
