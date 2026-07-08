import type { DialogueTemplate, WordFrame } from "../../types/domain";

export function renderTemplate(template: DialogueTemplate, word: WordFrame | null, words: WordFrame[] = []): string {
  if (!word && template.text.includes("{word}")) return "今はまだ、うまく言葉を選べませんでした。";
  if (!word) return template.text;

  const relatedWord = findRelatedWord(word, words);
  const values: Record<string, string> = {
    word: word.surface,
    reading: word.reading || word.surface,
    category: categoryLabel(word),
    emotion: emotionLabel(word),
    situation: situationLabel(word),
    stance: stanceLabel(word),
    relatedWord: relatedWord?.surface ?? "別の言葉",
    relation: relationLabel(word),
    useHint: useHint(word)
  };

  const rendered = Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(value), template.text);
  return compactJapaneseSpacing(rendered);
}

function findRelatedWord(word: WordFrame, words: WordFrame[]): WordFrame | null {
  const usable = words.filter((item) => item.id !== word.id && !item.is_blocked && !item.is_sensitive);
  return usable.find((item) => word.related_word_ids.includes(item.id)) ?? usable.find((item) => item.category === word.category) ?? null;
}

function categoryLabel(word: WordFrame): string {
  const labels: Record<WordFrame["category"], string> = {
    person: "人に関係する言葉",
    place: "場所の言葉",
    food: "食べ物の言葉",
    object: "物の言葉",
    action: "動きの言葉",
    feeling: "気持ちの言葉",
    time: "時間の言葉",
    idea: "考えごとの言葉",
    unknown: "まだ分類があいまいな言葉"
  };
  return labels[word.category];
}

function emotionLabel(word: WordFrame): string {
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
  return labels[word.emotion_tags[0]] ?? "ふつうの感じ";
}

function situationLabel(word: WordFrame): string {
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
  return labels[word.situation_tags[0]] ?? "何気ない会話";
}

function stanceLabel(word: WordFrame): string {
  if (word.user_stance === "like") return "好き寄り";
  if (word.user_stance === "dislike") return "苦手寄り";
  return "ふつう";
}

function relationLabel(word: WordFrame): string {
  const labels: Record<string, string> = {
    who: "人の話題",
    social: "人との距離",
    where: "場所の話題",
    scene: "場面",
    meal: "食事",
    daily: "毎日のこと",
    item: "手元の物",
    nearby: "近くにある物",
    do: "行動",
    habit: "習慣",
    feeling: "気持ち",
    mood: "気分",
    when: "時間",
    schedule: "予定",
    idea: "考えごと",
    meaning: "意味"
  };
  return labels[word.relation_tags[0]] ?? "近い意味";
}

function useHint(word: WordFrame): string {
  if (word.affordances.includes("ask_taste")) return "味や好き嫌いを聞けそう";
  if (word.affordances.includes("ask_where")) return "どんな場所か聞けそう";
  if (word.affordances.includes("ask_use")) return "何に使うか聞けそう";
  if (word.affordances.includes("ask_when")) return "いつのことか聞けそう";
  if (word.affordances.includes("ask_feeling")) return "気持ちを聞けそう";
  if (word.affordances.includes("ask_meaning")) return "意味をもう少し聞けそう";
  return "会話のきっかけにできそう";
}

function compactJapaneseSpacing(text: string): string {
  let compact = text
    .replace(/\s+([、。？！])/g, "$1")
    .replace(/」\s+([はをがにでともの])/g, "」$1")
    .replace(/([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}])\s+「/gu, "$1「");
  for (let index = 0; index < 4; index += 1) {
    compact = compact.replace(
      /([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}])\s+([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}])/gu,
      "$1$2"
    );
  }
  return compact;
}
