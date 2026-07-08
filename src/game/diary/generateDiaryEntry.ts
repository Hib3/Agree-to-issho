import type { DialogueContext, DiaryEntry } from "../../types/domain";
import { createId, nowIso } from "../../utils/id";

export function generateDiaryEntryFromContext(context: DialogueContext): DiaryEntry {
  const now = new Date(context.now);
  const date = now.toISOString().slice(0, 10);
  const usable = context.words.filter((word) => !word.is_blocked && !word.is_sensitive);
  const word = usable.sort((a, b) => a.use_count - b.use_count)[0];
  const body = word
    ? `今日は「${word.surface}」という言葉を思い出しました。まだ全部はわからないけれど、少しずつ私の中で形になっています。`
    : "今日は静かな一日でした。新しい言葉を待っています。";

  return {
    id: createId("diary"),
    entry_date: date,
    title: `${date} のメモ`,
    body,
    used_word_ids: word ? [word.id] : [],
    mood: word ? "curious" : "neutral",
    created_at: nowIso()
  };
}
