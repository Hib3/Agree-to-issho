import { aguriStyleRules } from "../../data/style/aguriStyleRules";
import type { DialogueTemplate, SpeechAct, WordFrame } from "../../types/domain";

type StyleInput = {
  template: DialogueTemplate;
  renderedText: string;
  speechAct: SpeechAct;
  word: WordFrame | null;
  turnIndex: number;
};

type StyleIntensity = "calm" | "warm" | "emphatic";

export function applyAguriStyle({ template, renderedText, speechAct, word, turnIndex }: StyleInput): string {
  const surface = word?.surface;
  const intensity = selectIntensity(speechAct);
  const base = buildStyledLines(template, renderedText, speechAct, intensity, surface);
  const lines = maybeAddLaugh(base, speechAct, turnIndex, intensity);
  return normalizeDialogueLines(lines, intensity);
}

function selectIntensity(speechAct: SpeechAct): StyleIntensity {
  if (aguriStyleRules.bridgeStyle.emphaticActs.includes(speechAct)) return "emphatic";
  if (aguriStyleRules.bridgeStyle.calmActs.includes(speechAct)) return "calm";
  return "warm";
}

function buildStyledLines(
  template: DialogueTemplate,
  fallback: string,
  speechAct: SpeechAct,
  intensity: StyleIntensity,
  surface?: string
): string[] {
  const word = surface ? `「${surface}」` : "その言葉";
  switch (speechAct) {
    case "greeting":
      return ["おかえりなさい。", "今日はどんな言葉を連れてきたのかなァっ。"];
    case "ask_new_word":
      return ["新しい言葉、ひとつ教えてくれる？", "短い言葉でもいいよ。ちゃんと覚えるから。"];
    case "ask_correction":
      return [`まァっ ${word} のこと、もう少し聞いてもいい？`, "まだ少しふわふわしてるんだよなァっ。"];
    case "recall_word":
      return [`なんかっ 今日は ${word} のことを思い出してたよ。`, "前に教えてくれた言葉だよなァっ。"];
    case "use_word_in_daily_talk":
      if (template.word_slot?.category === "place") return [`${word} って、行ける場所なのかな。`, "それとも心の中の場所かもしれませんねェっ。"];
      if (template.word_slot?.category === "feeling") return [`${word} って気持ち、少しわかる気がするよォっ。`];
      return [`${word} のこと、もう少し聞かせてほしいよォっ。`];
    case "praise_user":
      return ["めっちゃ言葉が増えてきたなァっ！", "アグリ、ちゃんとメモしておきまァっすっ。"];
    case "lonely_reaction":
      return ["まァっ 少し静かな時間だったね。", "話したくなったら、またここに来てよォっ。"];
    case "sleepy_reaction":
      return ["なんかっ 少しねむいかもしれませんねェっ。", "でも、声はちゃんと聞いてるよ。"];
    case "happy_reaction":
      return ["めっちゃうれしいなァっ！", "その言葉、部屋に置いておきたいよォっ！"];
    case "embarrassed_reaction":
      return ["あのっそのっ。", "ちょっと照れるかもしれませんねェっ。"];
    case "goodbye":
      return ["今日もありがとうなァっ。", "また言葉を教えてねェっ。"];
    default:
      return restyleFallback(fallback, intensity);
  }
}

function restyleFallback(text: string, intensity: StyleIntensity): string[] {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return ["まァっ。", "うまく言葉にできないけど、聞いているよォっ。"];
  return compact.split(/[。！？!?]\s*/).filter(Boolean).map((line, index) => finishLine(line, intensity, index));
}

function finishLine(line: string, intensity: StyleIntensity, index: number): string {
  const trimmed = line.trim();
  if (!trimmed) return "";
  if (/[！？!?。]$/.test(trimmed)) return trimmed;
  if (intensity === "emphatic") return `${trimmed}${index % 2 === 0 ? aguriStyleRules.endings.emphatic[0] : aguriStyleRules.endings.emphatic[1]}`;
  if (intensity === "warm") return `${trimmed}${index % 2 === 0 ? aguriStyleRules.endings.warm[0] : aguriStyleRules.endings.soft[0]}`;
  return `${trimmed}。`;
}

function maybeAddLaugh(lines: string[], speechAct: SpeechAct, turnIndex: number, intensity: StyleIntensity): string[] {
  const laughable = speechAct === "misunderstanding_joke" || speechAct === "embarrassed_reaction" || speechAct === "praise_user";
  if (intensity !== "emphatic" || !laughable || turnIndex % aguriStyleRules.laugh.maxEveryTurns !== 0) return lines;
  const count = speechAct === "praise_user" ? 4 : 6;
  return [...lines, `${aguriStyleRules.laugh.token.repeat(count)}っ！`];
}

function normalizeDialogueLines(lines: string[], intensity: StyleIntensity): string {
  const maxStyled = intensity === "emphatic" ? aguriStyleRules.bridgeStyle.maxStyledLinesPerTurn : 1;
  let styledCount = 0;

  return lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, aguriStyleRules.constraints.maxLines)
    .map((line) => {
      const clamped = line.length > aguriStyleRules.constraints.maxLineLength
        ? `${line.slice(0, aguriStyleRules.constraints.maxLineLength - 1)}…`
        : line;
      if (isStyledLine(clamped)) styledCount += 1;
      if (styledCount > maxStyled) return calmDownLine(clamped);
      return clamped;
    })
    .join("\n");
}

function isStyledLine(line: string): boolean {
  return /[ァ-ヴ]っ|ぎゃ|めっちゃ/.test(line);
}

function calmDownLine(line: string): string {
  return line
    .replace(/なァっ！?/g, "ね。")
    .replace(/よォっ！?/g, "よ。")
    .replace(/ですねェっ！?/g, "だね。")
    .replace(/かもしれませんねェっ！?/g, "かもしれないね。")
    .replace(/ございまァっすっ！?/g, "おくね。");
}
