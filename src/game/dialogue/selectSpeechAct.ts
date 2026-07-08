import type { DialogueContext, SpeechAct } from "../../types/domain";

export function selectSpeechAct(context: DialogueContext): SpeechAct {
  const usableWords = context.words.filter((word) => !word.is_blocked && !word.is_sensitive);
  if (usableWords.length === 0) return "ask_new_word";

  const totalUseCount = usableWords.reduce((sum, word) => sum + word.use_count, 0);
  const seed = totalUseCount + usableWords.length + new Date(context.now).getHours();
  const lowConfidenceCount = usableWords.filter((word) => word.confidence < 0.58).length;
  const unusedCount = usableWords.filter((word) => word.use_count === 0).length;
  const hasEmbarrassed = usableWords.some((word) => word.emotion_tags.includes("embarrassed"));
  const hasHappy = usableWords.some((word) => word.emotion_tags.includes("happy") || word.user_stance === "like");

  if (lowConfidenceCount > 0 && seed % 5 === 0) return "ask_correction";
  if (unusedCount > 0 && seed % 3 !== 1) return "recall_word";
  if (lowConfidenceCount > 0 && seed % 7 === 0) return "misunderstanding_joke";
  if (hasEmbarrassed && seed % 11 === 0) return "embarrassed_reaction";
  if (hasHappy && seed % 13 === 0) return "happy_reaction";
  return "use_word_in_daily_talk";
}
