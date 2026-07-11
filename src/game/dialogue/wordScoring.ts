import type { DialogueLog, DialogueTemplate, WordFrame } from "../../types/domain";
import { systemRandom, weightedPick, type RandomSource } from "./random";

export function scoreWordForTemplate(word: WordFrame, template: DialogueTemplate, now = new Date(), recentLogs: DialogueLog[] = [], words: WordFrame[] = []): number {
  if (word.is_blocked || word.is_sensitive || word.forgotten_at) return Number.NEGATIVE_INFINITY;
  if (template.speech_act === "ask_emotion" && word.category !== "food" && word.user_stance !== "unknown") return Number.NEGATIVE_INFINITY;
  if (template.word_slot?.category && word.category !== template.word_slot.category) return Number.NEGATIVE_INFINITY;
  if (template.word_slot?.situation && !word.situation_tags.includes(template.word_slot.situation)) return Number.NEGATIVE_INFINITY;

  const lastUsedMs = word.last_used_at ? new Date(word.last_used_at).getTime() : 0;
  const elapsedMs = lastUsedMs > 0 ? now.getTime() - lastUsedMs : Number.POSITIVE_INFINITY;
  const recentPenalty = elapsedMs < 1000 * 60 * 30 ? 5 : 0;
  const unusedPeriodBonus = !word.last_used_at ? 2.4 : Math.min(3, Math.max(0, elapsedMs / (1000 * 60 * 60 * 24)) * 0.35);
  const situationMatchBonus = template.word_slot?.situation && word.situation_tags.includes(template.word_slot.situation) ? 1.3 : 0;
  const importantEmotionBonus = word.emotion_tags.some((tag) => tag === "happy" || tag === "proud" || tag === "embarrassed" || tag === "lonely")
    ? 0.8
    : 0;
  const recentWordIds = new Set(recentLogs.slice(-3).flatMap((log) => log.used_word_ids));
  const recentCategoryIds = new Set(
    recentLogs
      .slice(-3)
      .flatMap((log) => log.used_word_ids)
      .map((id) => words.find((item) => item.id === id)?.category)
      .filter(Boolean)
  );
  const repeatedWordPenalty = recentWordIds.has(word.id) ? 2.2 : 0;
  const repeatedCategoryPenalty = recentCategoryIds.has(word.category) ? 0.8 : 0;
  const isReview = template.speech_act === "ask_correction" || template.speech_act === "ask_category" || template.speech_act === "ask_situation";
  const confidenceBonus = isReview ? (1 - word.confidence) * 3 : word.confidence * 3;
  const memoryBonus = word.memory_strength * 1.5;
  const favoriteBonus = word.favorite_score * 1.2;
  const relationBonus = template.speech_act === "ask_relation" && word.related_word_ids.length > 0 ? 1.5 : 0;
  const ambiguityPenalty = word.ambiguity_score > 0.75 && template.speech_act !== "ask_correction" ? 0.9 : 0;
  const usePenalty = Math.min(word.use_count, 12) * 0.38;
  return confidenceBonus + memoryBonus + favoriteBonus + relationBonus + unusedPeriodBonus + situationMatchBonus + importantEmotionBonus - ambiguityPenalty - usePenalty - recentPenalty - repeatedWordPenalty - repeatedCategoryPenalty;
}

export function selectWordForTemplate(
  words: WordFrame[],
  template: DialogueTemplate,
  nowIso?: string,
  recentLogs: DialogueLog[] = [],
  random: RandomSource = systemRandom
): WordFrame | null {
  const now = nowIso ? new Date(nowIso) : new Date();
  const scored = words
    .map((word) => ({ word, score: scoreWordForTemplate(word, template, now, recentLogs, words) }))
    .filter((item) => Number.isFinite(item.score));
  if (scored.length === 0) return null;

  const recentIds = new Set(recentLogs.filter((log) => !log.role || log.role === "character").slice(-3).flatMap((log) => log.used_word_ids));
  const recentCategories = recentLogs
    .filter((log) => !log.role || log.role === "character")
    .slice(-2)
    .map((log) => words.find((word) => log.used_word_ids.includes(word.id))?.category)
    .filter(Boolean);
  const categoryCooldown = recentCategories.length === 2 && recentCategories.every((category) => category === recentCategories[0])
    ? recentCategories[0]
    : null;
  const withoutRecentWords = scored.filter((item) => !recentIds.has(item.word.id));
  const strict = withoutRecentWords.filter((item) => item.word.category !== categoryCooldown);
  const pool = strict.length > 0 ? strict : withoutRecentWords.length > 0 ? withoutRecentWords : scored;
  const minimum = Math.min(...pool.map((item) => item.score));
  return weightedPick(
    pool.map((item) => ({
      value: item.word,
      weight: Math.max(0.05, item.score - minimum + 0.35 + (item.word.use_count === 0 ? 1.2 : 0))
    })),
    random
  );
}

export function getWordScoreDebug(words: WordFrame[], template: DialogueTemplate, nowIso: string, recentLogs: DialogueLog[] = []) {
  const now = new Date(nowIso);
  const finite = words
    .map((word) => ({ word, score: scoreWordForTemplate(word, template, now, recentLogs, words) }))
    .filter((item) => Number.isFinite(item.score));
  const minimum = finite.length ? Math.min(...finite.map((item) => item.score)) : 0;
  return finite.map((item) => ({ word_id: item.word.id, surface: item.word.surface, score: item.score, weight: Math.max(0.05, item.score - minimum + 0.35) }));
}
