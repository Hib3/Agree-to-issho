import type { EmotionTag, SituationTag, WordCategory, WordFrame } from "../../types/domain";
import { createId, nowIso } from "../../utils/id";
import { WORD_MEMORY_DEFAULTS } from "./wordMemory";

export function normalizeSurface(input: string): string {
  return input.trim().normalize("NFKC");
}

export function createWordFrame(input: string): WordFrame {
  const now = nowIso();
  const surface = normalizeSurface(input);
  return {
    id: createId("word"),
    surface,
    reading: "",
    category: "unknown",
    semantic_type: "unknown",
    part_of_speech: "unknown",
    user_stance: "unknown",
    character_stance: "curious",
    emotion_tags: [],
    situation_tags: [],
    relation_tags: [],
    affordances: [],
    related_word_ids: [],
    confidence: WORD_MEMORY_DEFAULTS.confidence,
    memory_strength: WORD_MEMORY_DEFAULTS.memory_strength,
    favorite_score: WORD_MEMORY_DEFAULTS.favorite_score,
    ambiguity_score: WORD_MEMORY_DEFAULTS.ambiguity_score,
    drift_level: WORD_MEMORY_DEFAULTS.drift_level,
    taught_by_user: true,
    source_question_ids: [],
    use_count: 0,
    review_count: WORD_MEMORY_DEFAULTS.review_count,
    correction_count: WORD_MEMORY_DEFAULTS.correction_count,
    created_at: now,
    updated_at: now,
    is_sensitive: false,
    is_blocked: false,
    notes: ""
  };
}

export function applyCategory(word: WordFrame, category: WordCategory): WordFrame {
  return {
    ...word,
    category,
    semantic_type: category,
    part_of_speech: category === "action" ? "verb" : "noun",
    source_question_ids: unique([...word.source_question_ids, "ask_category"]),
    confidence: Math.max(word.confidence, 0.6),
    ambiguity_score: Math.max(0.2, word.ambiguity_score - 0.04),
    updated_at: nowIso()
  };
}

export function applyEmotion(word: WordFrame, emotion: EmotionTag, stance: WordFrame["user_stance"]): WordFrame {
  return {
    ...word,
    user_stance: stance,
    character_stance: stance === "dislike" ? "confused" : stance === "like" ? "likes" : "curious",
    emotion_tags: unique([...word.emotion_tags, emotion]),
    source_question_ids: unique([...word.source_question_ids, "ask_emotion"]),
    confidence: Math.max(word.confidence, 0.72),
    favorite_score: Math.min(1, word.favorite_score + (stance === "like" ? 0.08 : 0.02)),
    updated_at: nowIso()
  };
}

export function applySituation(word: WordFrame, situation: SituationTag): WordFrame {
  return {
    ...word,
    situation_tags: unique([...word.situation_tags, situation]),
    affordances: unique([...word.affordances, `talk:${situation}`]),
    source_question_ids: unique([...word.source_question_ids, "ask_situation"]),
    confidence: Math.max(word.confidence, 0.84),
    memory_strength: Math.min(1, word.memory_strength + 0.06),
    updated_at: nowIso()
  };
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
