import type { DialogueTemplate, WordFrame } from "../../types/domain";

export function scoreWordForTemplate(word: WordFrame, template: DialogueTemplate, now = new Date()): number {
  if (word.is_blocked || word.is_sensitive) return Number.NEGATIVE_INFINITY;
  if (template.word_slot?.category && word.category !== template.word_slot.category) return Number.NEGATIVE_INFINITY;
  if (template.word_slot?.situation && !word.situation_tags.includes(template.word_slot.situation)) return Number.NEGATIVE_INFINITY;

  const recentPenalty = word.last_used_at && now.getTime() - new Date(word.last_used_at).getTime() < 1000 * 60 * 10 ? 4 : 0;
  const confidenceBonus = word.confidence * 3;
  const usePenalty = Math.min(word.use_count, 6) * 0.45;
  return confidenceBonus - usePenalty - recentPenalty;
}

export function selectWordForTemplate(words: WordFrame[], template: DialogueTemplate): WordFrame | null {
  const scored = words
    .map((word) => ({ word, score: scoreWordForTemplate(word, template) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score || a.word.created_at.localeCompare(b.word.created_at) || a.word.id.localeCompare(b.word.id));
  return scored[0]?.word ?? null;
}
