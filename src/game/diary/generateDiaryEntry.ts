import type { DialogueContext, DiaryEntry } from "../../types/domain";
import { createId, nowIso } from "../../utils/id";

export function generateDiaryEntryFromContext(context: DialogueContext): DiaryEntry {
  const now = new Date(context.now);
  const date = now.toISOString().slice(0, 10);
  const usable = context.words.filter((word) => !word.is_blocked && !word.is_sensitive && !word.forgotten_at);
  const todaysLogs = (context.dialogue_logs ?? []).filter((log) => log.created_at.slice(0, 10) === date);
  const talkedIds = new Set(todaysLogs.flatMap((log) => log.used_word_ids));
  const correctedToday = usable.some((word) => word.correction_count > 0 && word.updated_at.slice(0, 10) === date);
  const reviewedToday = usable.some((word) => word.review_count > 0 && word.last_reviewed_at?.slice(0, 10) === date);
  const driftedToday = todaysLogs.some((log) => log.speech_act === "misunderstanding_joke" || log.speech_act === "ask_correction");
  const words = [...usable]
    .sort((a, b) => {
      const aTalked = talkedIds.has(a.id) ? 1 : 0;
      const bTalked = talkedIds.has(b.id) ? 1 : 0;
      return bTalked - aTalked || b.updated_at.localeCompare(a.updated_at) || a.use_count - b.use_count;
    })
    .slice(0, 3);
  const mainWord = words[0];
  const body = mainWord
    ? buildDiaryBody(words, { driftedToday, correctedToday, reviewedToday })
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

function buildDiaryBody(words: NonNullable<DialogueContext["words"]>, flags: { driftedToday: boolean; correctedToday: boolean; reviewedToday: boolean }): string {
  const [first, second, third] = words;
  const surfaces = words.map((word) => `「${word.surface}」`).join("、");
  const firstFeeling = emotionLabel(first.emotion_tags[0]);
  const firstSituation = situationLabel(first.situation_tags[0]);
  const relation = second ? `それから${surfaces}を近くに置いたら、会話の道が少し増えた気がしました。` : "";
  const learningNote = flags.correctedToday
    ? "直してもらった言葉があって、前より少し輪郭が見えました。"
    : flags.reviewedToday
      ? "復習した言葉があって、ノートの中で少し強くなりました。"
      : flags.driftedToday
        ? "ちょっとズレた使い方もしたけど、それも覚え方の途中だと思っています。"
        : "";
  const tail = third
    ? `まだ全部は言えないけど、「${third.surface}」までつながると、部屋のメモがにぎやかになりまァっすっ。`
    : "まだ全部は言えないけど、少しずつ私の中で形になっています。";

  return `今日は${surfaces}のことを思い出しました。「${first.surface}」は${firstFeeling}で、${firstSituation}に出てきやすい言葉として覚えています。${relation}${learningNote}${tail}`;
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
