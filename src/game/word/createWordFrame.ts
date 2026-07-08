import type { EmotionTag, SituationTag, WordCategory, WordFrame } from "../../types/domain";
import { createId, nowIso } from "../../utils/id";

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
    confidence: 0.2,
    taught_by_user: true,
    source_question_ids: [],
    use_count: 0,
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
    confidence: Math.max(word.confidence, 0.45),
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
    confidence: Math.max(word.confidence, 0.65),
    updated_at: nowIso()
  };
}

export function applySituation(word: WordFrame, situation: SituationTag): WordFrame {
  return {
    ...word,
    situation_tags: unique([...word.situation_tags, situation]),
    affordances: unique([...word.affordances, `talk:${situation}`]),
    source_question_ids: unique([...word.source_question_ids, "ask_situation"]),
    confidence: Math.max(word.confidence, 0.82),
    updated_at: nowIso()
  };
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
