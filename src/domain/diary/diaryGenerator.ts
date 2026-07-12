import type { DialogueHistoryEntry } from "../model/conversation";
import type { Concept } from "../model/concept";
import type { DiaryEntry, MemoryEvent } from "../model/memory";
import { displayConcept } from "../grammar/japaneseRealizer";

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
  const body = names.length
    ? `今日は${names.map((name) => `「${name}」`).join("と")}のことを話したっ！ 教えてもらった線を、ノートにちゃんと残しましたァっ！`
    : "今日は静かな日でしたっ。次に会えたら、新しい言葉を聞いてみたいですっ！";
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
