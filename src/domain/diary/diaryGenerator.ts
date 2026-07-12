import type { DialogueHistoryEntry } from "../model/conversation";
import type { Concept } from "../model/concept";
import type { DiaryEntry, MemoryEvent } from "../model/memory";
import { displayConcept } from "../grammar/japaneseRealizer";
import { diaryTemplates } from "../../data/diary-templates/diaryTemplates";

export function generateDiary(input: {
  date: string;
  concepts: Concept[];
  memories: MemoryEvent[];
  dialogue: DialogueHistoryEntry[];
  now: number;
}): DiaryEntry {
  const todaysMemories = input.memories.filter((memory) => new Date(memory.createdAt).toISOString().slice(0, 10) === input.date);
  const todaysDialogue = input.dialogue.filter((turn) => new Date(turn.createdAt).toISOString().slice(0, 10) === input.date);
  const conceptIds = Array.from(new Set([...todaysMemories.flatMap((memory) => memory.conceptIds), ...todaysDialogue.flatMap((turn) => turn.conceptIds)])).slice(0, 4);
  const names = conceptIds
    .map((id) => input.concepts.find((concept) => concept.id === id))
    .filter((concept): concept is Concept => Boolean(concept))
    .map(displayConcept);
  const learnedIds = new Set(todaysMemories.filter((memory) => memory.type === "word_learned").flatMap((memory) => memory.conceptIds));
  const learnedNames = conceptIds
    .filter((id) => learnedIds.has(id))
    .map((id) => input.concepts.find((concept) => concept.id === id))
    .filter((concept): concept is Concept => Boolean(concept))
    .map(displayConcept);
  const corrected = todaysMemories.some((memory) => memory.type === "player_choice" && memory.payload.effect === "deny");
  const templateIndex = hash(`${input.date}:${conceptIds.join(":")}`) % diaryTemplates.length;
  const reflection = diaryTemplates[templateIndex]?.text ?? "今日の気分と一緒に、短いメモへ残しておいた。";
  const parts = names.length
    ? [`今日は${names.map((name) => `「${name}」`).join("と")}のことを話したっ！`]
    : ["今日は静かな時間を過ごしたっ！"];
  if (learnedNames.length) parts.push(`新しく覚えたのは${learnedNames.map((name) => `「${name}」`).join("と")}っ！`);
  if (corrected) parts.push("ちがう線を教えてもらったから、ノートを引き直したっ！");
  parts.push(reflection);
  const body = parts.join("\n");
  return {
    id: `diary_${input.date}`,
    date: input.date,
    title: names[0] ? `${names[0]}のメモ` : "静かなメモ",
    body,
    conceptIds,
    memoryIds: todaysMemories.map((memory) => memory.id),
    createdAt: input.now
  };
}

function hash(value: string) {
  return Array.from(value).reduce((total, character) => (total * 31 + (character.codePointAt(0) ?? 0)) >>> 0, 11);
}
