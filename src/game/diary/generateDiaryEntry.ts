import type { DialogueContext, DiaryEntry } from "../../types/domain";
import { createId, nowIso } from "../../utils/id";

export function generateDiaryEntryFromContext(context: DialogueContext): DiaryEntry {
  const now = new Date(context.now);
  const date = now.toISOString().slice(0, 10);
  const usable = context.words.filter((word) => !word.is_blocked && !word.is_sensitive);
  const words = [...usable]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.use_count - b.use_count)
    .slice(0, 3);
  const mainWord = words[0];
  const body = mainWord
    ? buildDiaryBody(words)
    : "今日は静かな一日でした。新しい言葉を待っています。";

  return {
    id: createId("diary"),
    entry_date: date,
    title: `${date} のメモ`,
    body,
    used_word_ids: words.map((word) => word.id),
    mood: mainWord ? mainWord.emotion_tags[0] ?? "curious" : "neutral",
    created_at: nowIso()
  };
}

function buildDiaryBody(words: NonNullable<DialogueContext["words"]>): string {
  const [first, second, third] = words;
  const surfaces = words.map((word) => `「${word.surface}」`).join("、");
  const firstFeeling = emotionLabel(first.emotion_tags[0]);
  const firstSituation = situationLabel(first.situation_tags[0]);
  const relation = second ? `それから${surfaces}を近くに置いたら、会話の道が少し増えた気がしました。` : "";
  const tail = third
    ? `まだ全部は言えないけど、「${third.surface}」までつながると、部屋のメモがにぎやかになりまァっすっ。`
    : "まだ全部は言えないけど、少しずつ私の中で形になっています。";

  return `今日は${surfaces}のことを思い出しました。「${first.surface}」は${firstFeeling}で、${firstSituation}に出てきやすい言葉として覚えています。${relation}${tail}`;
}

function emotionLabel(tag: string | undefined): string {
  const labels: Record<string, string> = {
    happy: "うれしい感じ",
    sad: "少しさみしい感じ",
    curious: "気になる感じ",
    lonely: "ひとりの感じ",
    sleepy: "ねむい感じ",
    embarrassed: "照れる感じ",
    proud: "ちょっと得意な感じ",
    neutral: "ふつうの感じ"
  };
  return labels[tag ?? ""] ?? "ふつうの感じ";
}

function situationLabel(tag: string | undefined): string {
  const labels: Record<string, string> = {
    greeting: "あいさつの時",
    daily_talk: "何気ない会話",
    room: "この部屋",
    memory: "思い出す時",
    question: "質問したい時",
    diary: "日記を書く時",
    event: "何かが起きた時",
    unknown: "まだ決まっていない場面"
  };
  return labels[tag ?? ""] ?? "何気ない会話";
}
