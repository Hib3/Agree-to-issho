# PWA Learning/Speaking State Machine

## Evidence Basis

- Public gameplay: user teaches words.
- Public gameplay: follow-up questions are asked about taught words.
- Public gameplay: learned words are reused in later conversation.
- Local analysis: `WORD/QUEST` referenced region exists.
- Local analysis: separate `ANS` referenced region exists.
- Local analysis: WQ and ANS function sets have `shared_function_count=0`, `direct_links=5`, `common_callees=9`.
- Local analysis: code-referenced `%s` markers exist in entry `1`.

## Non-Claims

- This does not reproduce original question text.
- This does not reproduce original word categories.
- This does not reproduce original answer save format.
- This does not prove `%s` receives learned user words.
- This does not reproduce original speech templates.

## State List

```text
idle
  No pending learning interaction.

drafting_word
  A user word has been accepted and normalized, but not finalized.

awaiting_learning_answer
  A follow-up question has been chosen and is waiting for user answer.

learned_word_committed
  A word and its minimal learning metadata have been committed.

speaking_without_word
  The system speaks an original line without learned-word insertion.

speaking_with_word
  The system speaks an original line with one learned word inserted.
```

## Learning Transitions

```text
idle
  -- learnWord(input) -->
drafting_word
  -- chooseLearningQuestion(draft) -->
awaiting_learning_answer
  -- applyLearningAnswer(answer) -->
drafting_word OR learned_word_committed
  -- finalizeLearnedWord(draft) -->
idle
```

Rules:

- `learnWord(input)` must store the exact user surface form in a draft.
- `learnWord(input)` must also compute a normalized form for duplicate checks.
- A new word must not become learned before at least one follow-up answer.
- `chooseLearningQuestion()` must not mutate committed learned words.
- `applyLearningAnswer()` must not choose new question text and apply the answer in the same opaque step.
- `finalizeLearnedWord()` must reject incomplete drafts.

## Speaking Transitions

```text
idle
  -- chooseSpeechSlot(context) -->
speaking_without_word OR speaking_with_word
  -- renderSpeech(slot, word?) -->
idle
```

Rules:

- `chooseSpeechSlot()` chooses only an original PWA slot.
- `pickWordForSpeech()` may return `null`.
- `renderSpeech()` may insert at most one learned word.
- If no compatible word exists, render without learned-word insertion.
- After insertion, update only PWA metadata such as `usageCount` and `lastUsedAt`.

## Minimal Runtime Shape

```ts
type RuntimeState =
  | { kind: "idle"; learnedWords: LearnedWord[] }
  | { kind: "drafting_word"; learnedWords: LearnedWord[]; draftWord: LearnedWordDraft }
  | {
      kind: "awaiting_learning_answer";
      learnedWords: LearnedWord[];
      draftWord: LearnedWordDraft;
      pendingQuestion: LearningQuestion;
    };
```

## Minimal Saved Shape

```ts
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

## Import/Export Contract

```ts
type LearningExport = {
  schemaVersion: number;
  learnedWords: LearnedWord[];
  pendingLearning?: {
    draftWord: LearnedWordDraft;
    pendingQuestion: LearningQuestion;
  };
  exportedAt: string;
};
```

Validation:

- Reject missing `schemaVersion`.
- Reject non-array `learnedWords`.
- Reject entries without `surface` or `normalized`.
- Reject data containing original asset fields, binary dumps, or extracted text arrays.
- Preserve pending learning state if present.

## Implementation Tests

- Teaching a new word enters `awaiting_learning_answer`.
- Answering required question commits exactly one learned word.
- Teaching duplicate normalized word does not create duplicate entry.
- Speaking with no compatible word produces original no-word utterance.
- Speaking with compatible words inserts at most one user word.
- Exported JSON contains user learning state only.
- Imported JSON is validated before merge.

## Forbidden Shortcuts

- Do not hard-code original questions.
- Do not hard-code original categories as if confirmed.
- Do not use original dialogue.
- Do not combine question choice and answer application into a single untestable function.
- Do not export generated research JSON as game save data.
