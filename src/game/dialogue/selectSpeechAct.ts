import type { DialogueContext, SpeechAct } from "../../types/domain";

export function selectSpeechAct(context: DialogueContext): SpeechAct {
  const usableWords = context.words.filter((word) => !word.is_blocked && !word.is_sensitive);
  if (usableWords.length === 0) return "ask_new_word";
  const lowConfidence = usableWords.some((word) => word.confidence < 0.65);
  if (lowConfidence) return "ask_correction";
  const unused = usableWords.some((word) => word.use_count === 0);
  if (unused) return "recall_word";
  return "use_word_in_daily_talk";
}
