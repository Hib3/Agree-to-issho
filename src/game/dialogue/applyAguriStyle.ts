import { aguriStyleRules } from "../../data/style/aguriStyleRules";
import type { DialogueTemplate, SpeechAct, WordFrame } from "../../types/domain";

type StyleInput = {
  template: DialogueTemplate;
  renderedText: string;
  speechAct: SpeechAct;
  word: WordFrame | null;
  turnIndex: number;
};

export function applyAguriStyle({ template, renderedText, speechAct, word, turnIndex }: StyleInput): string {
  const surface = word?.surface;
  const base = buildStyledLines(template, renderedText, speechAct, surface);
  const lines = maybeAddLaugh(base, speechAct, turnIndex);
  return normalizeDialogueLines(lines);
}

function buildStyledLines(template: DialogueTemplate, fallback: string, speechAct: SpeechAct, surface?: string): string[] {
  const word = surface ? `「${surface}」` : "その言葉";
  switch (speechAct) {
    case "ask_new_word":
      return ["新しい言葉、ひとつ教えてくれる？", "短い言葉でもいいよ。ちゃんと覚えるから。"];
    case "ask_correction":
      return [`${word} のこと、もう少し聞いてもいい？`, "まだ少しふわふわしてるから。"];
    case "recall_word":
      return [`今日は ${word} のことを思い出してたよ。`, "前に教えてくれた言葉だよね。"];
    case "use_word_in_daily_talk":
      if (template.word_slot?.category === "place") return [`${word} って、行ける場所なのかな。`, "それとも心の中の場所かな。"];
      if (template.word_slot?.category === "feeling") return [`${word} って気持ち、少しわかってきたよ。`];
      return [`${word} のこと、もう少し聞かせてほしいな。`];
    case "praise_user":
      return ["覚えた言葉が少しずつ増えてきたね。", "大事にメモしておくね。"];
    case "lonely_reaction":
      return ["少し静かな時間だったね。", "話したくなったら、またここに来てね。"];
    case "goodbye":
      return ["今日もありがとう。", "また言葉を教えてね。"];
    default:
      return restyleFallback(fallback);
  }
}

function restyleFallback(text: string): string[] {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return ["うまく言葉にできないけど、聞いているよ。"];
  return compact.split(/[。！？!?]\s*/).filter(Boolean).map((line) => finishLine(line));
}

function finishLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return "";
  if (/[！？!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}。`;
}

function maybeAddLaugh(lines: string[], speechAct: SpeechAct, turnIndex: number): string[] {
  const laughable = speechAct === "misunderstanding_joke" || speechAct === "embarrassed_reaction" || speechAct === "praise_user";
  if (!laughable || turnIndex % aguriStyleRules.laugh.maxEveryTurns !== 0) return lines;
  return [...lines, "ふふ。"];
}

function normalizeDialogueLines(lines: string[]): string {
  return lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, aguriStyleRules.constraints.maxLines)
    .map((line) => (line.length > aguriStyleRules.constraints.maxLineLength ? `${line.slice(0, aguriStyleRules.constraints.maxLineLength - 1)}…` : line))
    .join("\n");
}
