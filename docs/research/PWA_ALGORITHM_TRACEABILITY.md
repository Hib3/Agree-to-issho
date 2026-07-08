# PWA Algorithm Traceability

## Purpose

PWA実装で、Codexが勝手に作った仕様を原作由来として混ぜないための対応表。

## Evidence Summary

| Evidence | Status | Implementation Meaning |
| --- | --- | --- |
| User teaches words in the original game | Confirmed from public gameplay | PWA must accept user-provided words. |
| Additional questions after teaching words | Confirmed from public gameplay | PWA must ask follow-up questions before finalizing a word. |
| Learned words appear in later conversation | Confirmed from public gameplay | PWA must reuse learned words in speech. |
| `WORD/QUEST` region referenced 90 times | Confirmed from local structural analysis | Question-related labels/structures are referenced in entry 1. |
| `ANS` region referenced 34 times | Confirmed from local structural analysis | Answer-related labels/structures are referenced in a separate entry 1 region. |
| WQ and ANS functions share 0 functions, have 5 direct links and 9 common callees | Confirmed from heuristic call graph | Question and answer responsibilities should be separate but connected. |
| `%s` markers in entry 1 have 18 code xrefs | Confirmed from local structural analysis | Slot formatting exists. |
| `%s` inserts learned user words | Unknown | Do not claim; use only as weak support for slot-style rendering. |
| Original categories, weights, randomness, templates | Unknown | Do not implement as original behavior. |

## Function Contract Mapping

| PWA Function | Evidence Basis | Allowed Behavior | Not Allowed |
| --- | --- | --- | --- |
| `learnWord(input)` | Public gameplay: user teaches words | Accept exact user input, normalize for duplicate check, create draft | Invent original category set and call it original |
| `chooseLearningQuestion(draft, state)` | Public gameplay + `WORD/QUEST` referenced region | Ask one follow-up question about the new word | Use original question text; claim original question order |
| `applyLearningAnswer(answer, state)` | Public gameplay + separate `ANS` referenced region | Attach answer to pending draft or update existing word | Claim original answer save format |
| `finalizeLearnedWord(draft)` | Public gameplay: learned words persist | Commit word only after required question answers | Store original dictionaries or extracted text |
| `chooseSpeechSlot(context)` | `%s` code xrefs show slot formatting exists | Choose one safe original PWA slot | Use original templates or character voice |
| `pickWordForSpeech(slot, words)` | Public gameplay: learned words reused | Pick one compatible learned word; prefer simple deterministic fallback | Claim original weighting/randomness |
| `renderSpeech(slot, word)` | `%s` xrefs support slot rendering | Render original PWA sentence with at most one learned word | Reuse original dialogue, original phrasing, or extracted samples |
| `exportLearningData()` | User requirement for import/export | Export user-created learning JSON only | Export original data, generated scan JSON, or extracted strings |
| `importLearningData(data)` | User requirement for import/export | Import same clean JSON schema with validation | Import original disc data or copyrighted content |

## Implementation-Level Rules

For the required state machine and import/export shape, see `docs/research/PWA_LEARNING_SPEAKING_STATE_MACHINE.md`.
For speech slot selection, see `docs/research/SPEECH_SLOT_MODEL.md`.

### Learning

```text
learnWord
  -> normalize
  -> duplicate check
  -> create draft
  -> chooseLearningQuestion
  -> wait for answer
  -> applyLearningAnswer
  -> finalizeLearnedWord
```

Rules:

- Do not finalize a new word before at least one question is answered.
- Keep pending learning state serializable.
- If the same normalized word is taught again, update/review rather than duplicate.
- Keep exact user surface form for display.

### Speaking

```text
chooseSpeechSlot
  -> pickWordForSpeech
  -> renderSpeech
  -> mark word used
```

Rules:

- At most one learned word per utterance.
- If no compatible learned word exists, render an original sentence without learned-word insertion.
- No original dialogue text.
- No original character voice imitation.

### Import/Export

Rules:

- Export only user-created learning state.
- Include `schemaVersion`.
- Include pending learning state if a question is awaiting answer.
- Validate imported data before merging.
- Reject data containing fields that look like original asset dumps or extracted text corpora.

## Evidence Gaps

These must remain marked as unknown until proven:

- Original word table format.
- Original answer table format.
- Original category set.
- Original question selection order.
- Original speech template selection.
- Original learned-word scoring.
- Whether `%s` receives learned user words.

## Explicit Non-Claims

- This traceability table does not prove original internal categories.
- This traceability table does not prove original question order.
- This traceability table does not prove original answer save format.
- This traceability table does not prove `%s` receives learned user words.
- This traceability table does not authorize original text, original templates, or original character voice.

## Current Confidence

- Learning flow existence: high.
- Question/answer separation: medium.
- Slot-style rendering existence: medium-high.
- Learned-word slot insertion implementation details: low.
- Original weighting/category/template behavior: unknown.
