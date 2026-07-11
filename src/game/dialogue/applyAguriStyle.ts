import type { DialogueTemplate, SpeechAct, WordFrame } from "../../types/domain";

type StyleInput = {
  template: DialogueTemplate;
  renderedText: string;
  speechAct: SpeechAct;
  word: WordFrame | null;
  turnIndex: number;
  recentStyleIds?: string[];
};

const leads = [
  { id: "lead_maa", text: "まァっ、" },
  { id: "lead_ano", text: "あのォっ、" },
  { id: "lead_ne", text: "ねェっ、" }
] as const;

export function applyAguriStyle({ renderedText, speechAct, turnIndex, recentStyleIds = [] }: StyleInput): string {
  const base = normalize(renderedText);
  if (!base) return "まだうまく言えないから、少し考えておきます。";
  if (isCarefulAct(speechAct)) return base;

  const canDecorate = turnIndex % 3 !== 1;
  if (!canDecorate) return softenEnding(base, turnIndex);
  const available = leads.filter((item) => !recentStyleIds.slice(-2).includes(item.id));
  const lead = available[turnIndex % Math.max(1, available.length)] ?? leads[0];
  return `${lead.text}${softenEnding(base, turnIndex)}`;
}

function isCarefulAct(speechAct: SpeechAct) {
  return speechAct === "ask_correction" || speechAct === "confirm_meaning" || speechAct === "ask_category";
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function softenEnding(text: string, turnIndex: number) {
  if (/[？?]$/.test(text)) return text.replace(/\?$/, "？");
  if (turnIndex % 4 === 0 && /。$/.test(text)) return text.replace(/。$/, "ですよォっ！");
  return text;
}
