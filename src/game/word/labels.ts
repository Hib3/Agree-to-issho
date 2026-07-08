import type { DriftLevel, EmotionTag, SituationTag, WordCategory, WordFrame } from "../../types/domain";

const categoryLabels: Record<WordCategory, string> = {
  person: "人",
  place: "場所",
  food: "食べ物",
  object: "物",
  action: "動き",
  feeling: "気持ち",
  time: "時間",
  idea: "考えごと",
  unknown: "まだ不明"
};

const emotionLabels: Record<EmotionTag, string> = {
  happy: "うれしい",
  sad: "かなしい",
  curious: "気になる",
  lonely: "さみしい",
  sleepy: "ねむい",
  embarrassed: "照れる",
  proud: "大事",
  neutral: "ふつう"
};

const situationLabels: Record<SituationTag, string> = {
  greeting: "あいさつ",
  daily_talk: "日常",
  room: "部屋",
  memory: "思い出",
  question: "質問",
  diary: "日記",
  event: "できごと",
  unknown: "まだ不明"
};

export function getCategoryLabel(category: WordCategory | undefined): string {
  return categoryLabels[category ?? "unknown"] ?? "まだ不明";
}

export function getEmotionLabel(emotion: EmotionTag | undefined): string {
  return emotion ? emotionLabels[emotion] ?? "まだ不明" : "未設定";
}

export function getSituationLabel(situation: SituationTag | undefined): string {
  return situation ? situationLabels[situation] ?? "まだ不明" : "未設定";
}

export function getStanceLabel(stance: WordFrame["user_stance"] | undefined): string {
  if (stance === "like") return "好き寄り";
  if (stance === "dislike") return "苦手寄り";
  if (stance === "neutral") return "ふつう";
  return "まだ不明";
}

export function getPartOfSpeechLabel(part: WordFrame["part_of_speech"] | undefined): string {
  if (part === "noun") return "名詞";
  if (part === "verb") return "動き";
  if (part === "adjective") return "様子";
  if (part === "phrase") return "フレーズ";
  return "まだ不明";
}

export function getDriftLevelLabel(level: DriftLevel | undefined): string {
  if (level === 0) return "正しく使う";
  if (level === 1) return "少しだけ遊ぶ";
  if (level === 2) return "たまに勘違い";
  if (level === 3) return "よく勘違い";
  return "まだ不明";
}

export function getMemoryStrengthLabel(value: number | undefined): string {
  if (value === undefined) return "未設定";
  if (value >= 0.75) return "しっかり覚えた";
  if (value >= 0.45) return "だいたい覚えた";
  return "まだふわふわ";
}

export function getConfidenceLabel(value: number | undefined): string {
  if (value === undefined) return "未設定";
  if (value >= 0.8) return "よくわかった";
  if (value >= 0.55) return "少しわかった";
  return "聞き直したい";
}
