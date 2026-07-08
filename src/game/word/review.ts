import type { EmotionTag, SituationTag, WordCategory, WordFrame } from "../../types/domain";
import { nowIso } from "../../utils/id";
import { applyReview } from "./wordMemory";

export const reviewCategoryOptions: Array<{ value: WordCategory; label: string }> = [
  { value: "person", label: "人" },
  { value: "place", label: "場所" },
  { value: "food", label: "食べ物" },
  { value: "object", label: "物" },
  { value: "action", label: "動き" },
  { value: "feeling", label: "気持ち" },
  { value: "time", label: "時間" },
  { value: "idea", label: "考えごと" },
  { value: "unknown", label: "まだ不明" }
];

export const reviewEmotionOptions: Array<{ value: EmotionTag; label: string }> = [
  { value: "happy", label: "うれしい" },
  { value: "sad", label: "かなしい" },
  { value: "curious", label: "気になる" },
  { value: "lonely", label: "さみしい" },
  { value: "sleepy", label: "ねむい" },
  { value: "embarrassed", label: "照れる" },
  { value: "proud", label: "大事" },
  { value: "neutral", label: "ふつう" }
];

export const reviewSituationOptions: Array<{ value: SituationTag; label: string }> = [
  { value: "greeting", label: "あいさつ" },
  { value: "daily_talk", label: "日常" },
  { value: "room", label: "部屋" },
  { value: "memory", label: "思い出" },
  { value: "question", label: "質問" },
  { value: "diary", label: "日記" },
  { value: "event", label: "できごと" },
  { value: "unknown", label: "まだ不明" }
];

export type WordReviewPatch = {
  category: WordCategory;
  emotion: EmotionTag;
  situation: SituationTag;
  reading?: string;
  notes?: string;
};

export function applyDetailedReview(word: WordFrame, patch: WordReviewPatch): WordFrame {
  const now = nowIso();
  const reviewed = applyReview({
    ...word,
    category: patch.category,
    semantic_type: patch.category,
    part_of_speech: patch.category === "action" ? "verb" : "noun",
    emotion_tags: [patch.emotion],
    situation_tags: [patch.situation],
    reading: patch.reading?.trim() ?? word.reading,
    notes: patch.notes ?? word.notes,
    affordances: unique([...word.affordances, `review:${patch.category}`, `talk:${patch.situation}`]),
    source_question_ids: unique([...word.source_question_ids, "review_category", "review_emotion", "review_situation"]),
    ambiguity_score: Math.max(0, word.ambiguity_score - 0.04),
    updated_at: now
  }, now);
  return {
    ...reviewed,
    updated_at: now
  };
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
