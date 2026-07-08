import type { WordFrame } from "../../types/domain";

export const WORD_MEMORY_DEFAULTS = {
  confidence: 0.55,
  memory_strength: 0.4,
  favorite_score: 0.2,
  ambiguity_score: 0.4,
  drift_level: 1,
  review_count: 0,
  correction_count: 0
} as const;

export function migrateWordFrame(input: Partial<WordFrame> & Pick<WordFrame, "id" | "surface">): WordFrame {
  const now = new Date().toISOString();
  return {
    id: input.id,
    surface: input.surface,
    reading: input.reading ?? "",
    category: input.category ?? "unknown",
    semantic_type: input.semantic_type ?? input.category ?? "unknown",
    part_of_speech: input.part_of_speech ?? "unknown",
    user_stance: input.user_stance ?? "unknown",
    character_stance: input.character_stance ?? "curious",
    emotion_tags: input.emotion_tags ?? [],
    situation_tags: input.situation_tags ?? [],
    relation_tags: input.relation_tags ?? [],
    affordances: input.affordances ?? [],
    related_word_ids: input.related_word_ids ?? [],
    confidence: input.confidence ?? WORD_MEMORY_DEFAULTS.confidence,
    memory_strength: input.memory_strength ?? WORD_MEMORY_DEFAULTS.memory_strength,
    favorite_score: input.favorite_score ?? WORD_MEMORY_DEFAULTS.favorite_score,
    ambiguity_score: input.ambiguity_score ?? WORD_MEMORY_DEFAULTS.ambiguity_score,
    drift_level: input.drift_level ?? WORD_MEMORY_DEFAULTS.drift_level,
    taught_by_user: input.taught_by_user ?? true,
    source_question_ids: input.source_question_ids ?? [],
    use_count: input.use_count ?? 0,
    review_count: input.review_count ?? WORD_MEMORY_DEFAULTS.review_count,
    correction_count: input.correction_count ?? WORD_MEMORY_DEFAULTS.correction_count,
    ...(input.last_used_at ? { last_used_at: input.last_used_at } : {}),
    ...(input.last_reviewed_at ? { last_reviewed_at: input.last_reviewed_at } : {}),
    ...(input.last_context_used ? { last_context_used: input.last_context_used } : {}),
    ...(input.pronunciation_key ? { pronunciation_key: input.pronunciation_key } : {}),
    ...(input.forgotten_at ? { forgotten_at: input.forgotten_at } : {}),
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? input.created_at ?? now,
    is_sensitive: input.is_sensitive ?? false,
    is_blocked: input.is_blocked ?? false,
    notes: input.notes ?? ""
  };
}

export function applyReview(word: WordFrame, now = new Date().toISOString()): WordFrame {
  return migrateWordFrame({
    ...word,
    review_count: word.review_count + 1,
    last_reviewed_at: now,
    confidence: Math.min(1, word.confidence + 0.05),
    memory_strength: Math.min(1, word.memory_strength + 0.05),
    ambiguity_score: Math.max(0, word.ambiguity_score - 0.03),
    updated_at: now
  });
}

export function applyCorrectionFeedback(word: WordFrame, now = new Date().toISOString()): WordFrame {
  return migrateWordFrame({
    ...word,
    correction_count: word.correction_count + 1,
    confidence: Math.min(1, word.confidence + 0.08),
    ambiguity_score: Math.max(0, word.ambiguity_score - 0.05),
    updated_at: now
  });
}
