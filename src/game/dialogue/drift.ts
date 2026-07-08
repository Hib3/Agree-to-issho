import type { DialogueContext, DialogueTemplate, WordFrame } from "../../types/domain";
import { applyCorrectionFeedback } from "../word/wordMemory";

export type DriftMode = "correct_use" | "mild_drift" | "playful_misuse" | "ask_correction";

export function chooseDriftMode(word: WordFrame, context: DialogueContext): DriftMode {
  if (word.is_blocked || word.is_sensitive || word.forgotten_at || word.drift_level === 0) return "correct_use";
  if (shouldAskCorrection(word, context)) return "ask_correction";
  const driftScore = word.ambiguity_score + word.drift_level * 0.18 - word.confidence * 0.25 - word.correction_count * 0.08;
  if (driftScore > 0.85) return "playful_misuse";
  if (driftScore > 0.45) return "mild_drift";
  return "correct_use";
}

export function shouldAskCorrection(word: WordFrame, _context: DialogueContext): boolean {
  return word.confidence < 0.52 || word.ambiguity_score > 0.82;
}

export function renderDriftText(word: WordFrame, mode: DriftMode): string {
  if (mode === "ask_correction") return `「${word.surface}」の使い方、まだふわふわしています。もう少しだけ聞いてもいいですか？`;
  if (mode === "correct_use") return `「${word.surface}」は、今日はそのまま大事に使えそうです。`;
  if (word.category === "food") return `「${word.surface}」を、気持ちの味みたいに言おうとしました。ちょっと変ですか？`;
  if (word.category === "place") return `「${word.surface}」を、心の置き場所みたいに使おうとしました。`;
  if (word.category === "object") return `「${word.surface}」に話しかけたら返事がありそうな気がしました。`;
  if (word.category === "action") return `「${word.surface}」を毎朝の健康法みたいに覚えかけています。`;
  if (word.category === "feeling") return `「${word.surface}」に形があるなら、机の上に置けるのかなって思いました。`;
  return `「${word.surface}」の使い方、少しだけ斜めに覚えかけています。`;
}

export function createDriftTemplate(word: WordFrame, mode: DriftMode): DialogueTemplate {
  return {
    id: `drift_${mode}_${word.category}`,
    speech_act: mode === "ask_correction" ? "ask_correction" : "misunderstanding_joke",
    text: renderDriftText(word, mode),
    intent: "correction",
    word_slot: {},
    expression: mode === "playful_misuse" ? "confused" : "thinking"
  };
}

export function applyCorrectionToWord(word: WordFrame): WordFrame {
  return applyCorrectionFeedback(word);
}
