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
  const intensity = selectIntensity(speechAct);
  const base = buildStyledLines(template, renderedText, speechAct, intensity, word);
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
  word: WordFrame | null
): string[] {
  const hasWord = Boolean(word?.surface);
  switch (speechAct) {
    case "greeting":
      return ["はァっいっ！", "おかえりなさいでございまァっすっ！", "今日はどんな言葉を連れてきたのかなァっ！"];
    case "ask_new_word":
      return ["新しい言葉っ！", "ひとつ教えてくれるとうれしいよォっ！", "アグリっ！ちゃんと覚えまァっすっ！"];
    case "ask_correction":
      return withAguriLead(fallback, hasWord ? "まァっ この言葉のことっ！" : "まァっ その言葉のことっ！", intensity);
    case "recall_word":
      return withAguriLead(fallback, "なんかっ 思い出してたんだよなァっ！", intensity);
    case "use_word_in_daily_talk":
      return withAguriLead(fallback, "まァっ この話っ！", intensity);
    case "misunderstanding_joke":
      return withAguriLead(fallback, "えェっ そう使うのかっ！", intensity);
    case "praise_user":
      return ["めっちゃ言葉が増えてきたなァっ！", "アグリっ！ちゃんとメモしておりまァっすっ！", "ご協力ありがとうございまァっすっ！"];
    case "lonely_reaction":
      return ["まァっ 少し静かな時間だったね。", "話したくなったら、またここに来てよォっ。"];
    case "sleepy_reaction":
      return ["なんかっ 少しねむいかもしれませんねェっ！", "でもっ声はちゃんと聞いてるよォっ！"];
    case "happy_reaction":
      return withAguriLead(fallback, "めっちゃうれしいなァっ！", intensity);
    case "embarrassed_reaction":
      return withAguriLead(fallback, "あのっそのっ！", intensity);
    case "goodbye":
      return ["今日もありがとなァっ！", "また言葉を連れてきてくれよォっ！"];
    default:
      return restyleFallback(fallback, intensity);
  }
}

function withAguriLead(text: string, lead: string, intensity: StyleIntensity): string[] {
  const content = restyleFallback(text, intensity);
  return [lead, ...content].slice(0, aguriStyleRules.constraints.maxLines);
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
  if (/か$/.test(trimmed)) return `${trimmed}？`;
  if (/(ください|くださいね|ます|ました|です|でした|います|いました|ています|よさそう)$/.test(trimmed)) return `${trimmed}。`;
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
  const maxStyled = intensity === "emphatic" ? aguriStyleRules.bridgeStyle.maxStyledLinesPerTurn : 2;
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
