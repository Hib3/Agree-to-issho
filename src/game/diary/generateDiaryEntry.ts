import type { DialogueContext, DiaryEntry } from "../../types/domain";
import { createId, nowIso } from "../../utils/id";

export function generateDiaryEntryFromContext(context: DialogueContext): DiaryEntry {
  const now = new Date(context.now);
  const date = now.toISOString().slice(0, 10);
  const usable = context.words.filter((word) => !word.is_blocked && !word.is_sensitive && !word.forgotten_at);
  const todaysLogs = (context.dialogue_logs ?? []).filter((log) => log.created_at.slice(0, 10) === date);
  const todaysSessions = (context.conversation_sessions ?? []).filter((session) => session.started_at.slice(0, 10) === date && session.phase === "completed");
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
  const playerAnswered = todaysLogs.some((log) => log.role === "player");
  const relationConfirmed = todaysSessions.some((session) => session.intent.startsWith("relation.") && session.answer_value === "related");
  const body = mainWord
    ? buildDiaryBody(words, { driftedToday, correctedToday, reviewedToday, playerAnswered, relationConfirmed }, todaysLogs.length % 3)
    : "今日は静かな一日でした。新しい言葉を待っています。";

  return {
    id: createId("diary"),
    entry_date: date,
    title: `${date} のメモ`,
    body,
    used_word_ids: words.map((word) => word.id),
    source_log_ids: todaysLogs.map((log) => log.id),
    source_session_ids: todaysSessions.map((session) => session.id),
    mood: mainWord ? mainWord.emotion_tags[0] ?? "curious" : "neutral",
    created_at: nowIso()
  };
}

function buildDiaryBody(words: NonNullable<DialogueContext["words"]>, flags: { driftedToday: boolean; correctedToday: boolean; reviewedToday: boolean; playerAnswered: boolean; relationConfirmed: boolean }, variant: number): string {
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
  const answerNote = flags.playerAnswered ? "質問に答えてもらえたので、言葉の意味をひとつ確かめられました。" : "";
  const relationNote = flags.relationConfirmed ? "二つの言葉のつながりも、ひとつ確認できました。" : "";
  const tail = third
    ? `まだ全部は言えないけど、「${third.surface}」までつながると、部屋のメモがにぎやかになりまァっすっ。`
    : "まだ全部は言えないけど、少しずつ私の中で形になっています。";

  if (variant === 1) return `ノートを見返すと、今日は${surfaces}が残っていました。最初の「${first.surface}」は${firstFeeling}で、${firstSituation}の言葉です。${answerNote}${relationNote}${learningNote}${tail}`;
  if (variant === 2) return `今日は${firstSituation}の話から、${surfaces}を思い出しました。「${first.surface}」には${firstFeeling}の印をつけています。${relation}${answerNote}${relationNote}${learningNote}${tail}`;
  return `今日は${surfaces}のことを思い出しました。「${first.surface}」は${firstFeeling}で、${firstSituation}に出てきやすい言葉として覚えています。${relation}${answerNote}${relationNote}${learningNote}${tail}`;
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
