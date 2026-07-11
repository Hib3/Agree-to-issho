import { aguriStyleRules, type AguriStyleCondition } from "../../data/style/aguriStyleRules";
import type { DialogueTemplate, SpeechAct, WordFrame } from "../../types/domain";

type StyleInput = {
  template: DialogueTemplate;
  renderedText: string;
  speechAct: SpeechAct;
  word: WordFrame | null;
  turnIndex: number;
  recentTexts?: string[];
};

export function applyAguriStyle({ renderedText, speechAct, turnIndex, recentTexts = [] }: StyleInput): string {
  const base = normalize(renderedText);
  if (!base) return "まだうまく言えないからっ、少し考えておきまァっすっ！";

  const condition = selectCondition(speechAct, base);
  let lines = splitClauses(base);
  lines = applyCondition(lines, condition, turnIndex);

  if (shouldLaugh(condition, turnIndex, recentTexts)) {
    const counts = aguriStyleRules.laugh.allowedCounts;
    const count = counts[turnIndex % Math.min(2, counts.length)] ?? 4;
    lines.push(`${aguriStyleRules.laugh.token.repeat(count)}っ！`);
  }

  return lines.map(cleanLine).filter(Boolean).join("\n");
}

function selectCondition(speechAct: SpeechAct, text: string): AguriStyleCondition | "statement" {
  if (speechAct === "goodbye") return "closing_thanks";
  if (speechAct === "lonely_reaction" || (speechAct === "praise_user" && /苦手|無理|違って|大丈夫|さみし|つら/.test(text))) return "empathy";
  if (speechAct === "misunderstanding_joke" || speechAct === "embarrassed_reaction") return "comic_release";
  if (speechAct === "happy_reaction" || speechAct === "praise_user") return "praise";
  if (speechAct === "greeting") return "greeting_daily";
  if (speechAct === "ask_relation" && /それとも|どちら|二つ|2つ/.test(text)) return "choice_or_branch";
  if (speechAct === "ask_category" || speechAct === "ask_emotion" || speechAct === "ask_situation" || speechAct === "ask_relation" || speechAct === "ask_correction" || speechAct === "confirm_meaning" || /[？?]$/.test(text)) {
    return "self_softening";
  }
  if (speechAct === "ask_new_word") return "self_softening";
  return "statement";
}

function applyCondition(lines: string[], condition: AguriStyleCondition | "statement", turnIndex: number): string[] {
  if (lines.length === 0) return lines;
  switch (condition) {
    case "greeting_daily":
      return turnIndex % 2 === 0
        ? ["アグリっ！", ...replaceLast(lines, applyPoliteEnding)]
        : replaceLast(lines, applyPoliteEnding);
    case "praise":
      return /めっちゃ/.test(lines.join(""))
        ? replaceLast(lines, applyWarmEnding)
        : ["めっちゃうれしいなァっ！", ...lines];
    case "empathy":
      return /そうなんだよなァっ|わかるよォっ/.test(lines.join(""))
        ? lines
        : [turnIndex % 2 === 0 ? "そうなんだよなァっ。" : "めっちゃわかるよォっ。", ...lines];
    case "surprise":
      return ["えェっ！？", ...lines];
    case "choice_or_branch":
      return turnIndex % 3 === 0 ? [...lines, "それもまた選択だねっ！"] : applySoftener(lines, turnIndex);
    case "self_softening":
      return turnIndex % 3 === 1 ? replaceLast(lines, applyPoliteEnding) : applySoftener(lines, turnIndex);
    case "comic_release":
      return applySoftener(lines, turnIndex);
    case "closing_thanks":
      return /ありがと/.test(lines.join("")) ? replaceLast(lines, applyPoliteEnding) : [...lines, "ありがとなァっ！"];
    default:
      return turnIndex % 2 === 0 ? replaceLast(lines, applyWarmEnding) : applySoftener(lines, turnIndex);
  }
}

function applySoftener(lines: string[], turnIndex: number) {
  const openers = aguriStyleRules.openers.softener;
  const opener = openers[turnIndex % openers.length] ?? "まァっ";
  if (lines[0].startsWith(opener) || hasStrongStyle(lines[0])) return lines;
  return [`${opener}、${lines[0]}`, ...lines.slice(1)];
}

function applyPoliteEnding(line: string) {
  if (/[？?]$/.test(line)) return line.replace(/\?$/, "？");
  return line
    .replace(/ます。$/, "まァっすっ！")
    .replace(/です。$/, "ですねェっ！")
    .replace(/ね。$/, "ねェっ！")
    .replace(/よ。$/, "よォっ！");
}

function applyWarmEnding(line: string) {
  if (/[？?]$/.test(line)) return line.replace(/\?$/, "？");
  const polite = applyPoliteEnding(line);
  if (polite !== line || hasStrongStyle(line)) return polite;
  return line;
}

function replaceLast(lines: string[], transform: (line: string) => string) {
  return [...lines.slice(0, -1), transform(lines[lines.length - 1])];
}

function shouldLaugh(condition: AguriStyleCondition | "statement", turnIndex: number, recentTexts: string[]) {
  if (condition !== "comic_release") return false;
  if (recentTexts.slice(-2).some((text) => text.includes(aguriStyleRules.laugh.token))) return false;
  return turnIndex % aguriStyleRules.laugh.maxEveryTurns === 0;
}

function splitClauses(text: string) {
  return (text.match(/[^。！？\n]+[。！？]?/g) ?? [text]).map((line) => line.trim()).filter(Boolean);
}

function normalize(text: string) {
  return text.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

function cleanLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function hasStrongStyle(text: string) {
  return /(?:なァっ|よォっ|ねェっ|まァっすっ|めっちゃ|ぎゃぎゃ)/.test(text);
}
