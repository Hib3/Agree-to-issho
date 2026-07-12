export type MemoryCallbackTemplate = { id: string; memoryType: string; text: string };

const memoryTypes = ["word_learned", "word_reviewed", "conversation", "outing", "rumor", "discovery", "warning", "meeting", "diary", "player_choice"];
const callbacks = [
  "前のノートを開いたら、{concept}のことが目に入りましたっ。",
  "この場所に来ると、{concept}の話を思い出しますねェっ。",
  "少し時間がたってから、{concept}の意味がまた気になりました。",
  "この前選んだ答えから、{concept}へ線が伸びているんです。",
  "今日の気分だと、{concept}を前とは違う角度で見られそうです。",
  "忘れないうちに、{concept}の続きを聞いてみたいですっ。"
];

export const memoryCallbackTemplates: MemoryCallbackTemplate[] = memoryTypes.flatMap((memoryType, typeIndex) =>
  callbacks.map((text, index) => ({ id: `memory_callback_${typeIndex}_${index}`, memoryType, text }))
);
