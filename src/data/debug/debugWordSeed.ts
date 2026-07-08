import type { EmotionTag, SituationTag, WordCategory, WordFrame } from "../../types/domain";

type SeedEntry = {
  surface: string;
  reading: string;
  category: Exclude<WordCategory, "unknown">;
};

type CategoryProfile = {
  semantic_type: string;
  part_of_speech: WordFrame["part_of_speech"];
  user_stance: WordFrame["user_stance"];
  character_stance: WordFrame["character_stance"];
  emotion_tags: EmotionTag[];
  situation_tags: SituationTag[];
  relation_tags: string[];
  affordances: string[];
};

const seedEntries: SeedEntry[] = [
  { surface: "カレー", reading: "かれー", category: "food" },
  { surface: "おにぎり", reading: "おにぎり", category: "food" },
  { surface: "味噌汁", reading: "みそしる", category: "food" },
  { surface: "りんご", reading: "りんご", category: "food" },
  { surface: "お茶", reading: "おちゃ", category: "food" },
  { surface: "パン", reading: "ぱん", category: "food" },
  { surface: "たまご", reading: "たまご", category: "food" },
  { surface: "うどん", reading: "うどん", category: "food" },
  { surface: "チョコ", reading: "ちょこ", category: "food" },
  { surface: "サラダ", reading: "さらだ", category: "food" },
  { surface: "コロッケ", reading: "ころっけ", category: "food" },
  { surface: "いちご", reading: "いちご", category: "food" },
  { surface: "公園", reading: "こうえん", category: "place" },
  { surface: "図書館", reading: "としょかん", category: "place" },
  { surface: "駅", reading: "えき", category: "place" },
  { surface: "商店街", reading: "しょうてんがい", category: "place" },
  { surface: "台所", reading: "だいどころ", category: "place" },
  { surface: "机", reading: "つくえ", category: "place" },
  { surface: "学校", reading: "がっこう", category: "place" },
  { surface: "海辺", reading: "うみべ", category: "place" },
  { surface: "坂道", reading: "さかみち", category: "place" },
  { surface: "ベランダ", reading: "べらんだ", category: "place" },
  { surface: "部屋", reading: "へや", category: "place" },
  { surface: "本屋", reading: "ほんや", category: "place" },
  { surface: "ノート", reading: "のーと", category: "object" },
  { surface: "ペン", reading: "ぺん", category: "object" },
  { surface: "ランプ", reading: "らんぷ", category: "object" },
  { surface: "かばん", reading: "かばん", category: "object" },
  { surface: "時計", reading: "とけい", category: "object" },
  { surface: "傘", reading: "かさ", category: "object" },
  { surface: "鍵", reading: "かぎ", category: "object" },
  { surface: "コップ", reading: "こっぷ", category: "object" },
  { surface: "椅子", reading: "いす", category: "object" },
  { surface: "本", reading: "ほん", category: "object" },
  { surface: "付箋", reading: "ふせん", category: "object" },
  { surface: "植木鉢", reading: "うえきばち", category: "object" },
  { surface: "歩く", reading: "あるく", category: "action" },
  { surface: "眠る", reading: "ねむる", category: "action" },
  { surface: "笑う", reading: "わらう", category: "action" },
  { surface: "走る", reading: "はしる", category: "action" },
  { surface: "読む", reading: "よむ", category: "action" },
  { surface: "書く", reading: "かく", category: "action" },
  { surface: "歌う", reading: "うたう", category: "action" },
  { surface: "待つ", reading: "まつ", category: "action" },
  { surface: "作る", reading: "つくる", category: "action" },
  { surface: "探す", reading: "さがす", category: "action" },
  { surface: "片づける", reading: "かたづける", category: "action" },
  { surface: "深呼吸", reading: "しんこきゅう", category: "action" },
  { surface: "うれしい", reading: "うれしい", category: "feeling" },
  { surface: "さみしい", reading: "さみしい", category: "feeling" },
  { surface: "ねむい", reading: "ねむい", category: "feeling" },
  { surface: "はずかしい", reading: "はずかしい", category: "feeling" },
  { surface: "こわい", reading: "こわい", category: "feeling" },
  { surface: "たのしい", reading: "たのしい", category: "feeling" },
  { surface: "くやしい", reading: "くやしい", category: "feeling" },
  { surface: "おだやか", reading: "おだやか", category: "feeling" },
  { surface: "どきどき", reading: "どきどき", category: "feeling" },
  { surface: "ほっとする", reading: "ほっとする", category: "feeling" },
  { surface: "びっくり", reading: "びっくり", category: "feeling" },
  { surface: "もやもや", reading: "もやもや", category: "feeling" },
  { surface: "朝", reading: "あさ", category: "time" },
  { surface: "昼", reading: "ひる", category: "time" },
  { surface: "夜", reading: "よる", category: "time" },
  { surface: "夕方", reading: "ゆうがた", category: "time" },
  { surface: "週末", reading: "しゅうまつ", category: "time" },
  { surface: "月曜日", reading: "げつようび", category: "time" },
  { surface: "雨の日", reading: "あめのひ", category: "time" },
  { surface: "夏", reading: "なつ", category: "time" },
  { surface: "冬", reading: "ふゆ", category: "time" },
  { surface: "春", reading: "はる", category: "time" },
  { surface: "誕生日", reading: "たんじょうび", category: "time" },
  { surface: "明日", reading: "あした", category: "time" },
  { surface: "友だち", reading: "ともだち", category: "person" },
  { surface: "先生", reading: "せんせい", category: "person" },
  { surface: "家族", reading: "かぞく", category: "person" },
  { surface: "となりの人", reading: "となりのひと", category: "person" },
  { surface: "お客さん", reading: "おきゃくさん", category: "person" },
  { surface: "自分", reading: "じぶん", category: "person" },
  { surface: "あなた", reading: "あなた", category: "person" },
  { surface: "店員さん", reading: "てんいんさん", category: "person" },
  { surface: "先輩", reading: "せんぱい", category: "person" },
  { surface: "後輩", reading: "こうはい", category: "person" },
  { surface: "約束", reading: "やくそく", category: "idea" },
  { surface: "秘密", reading: "ひみつ", category: "idea" },
  { surface: "思い出", reading: "おもいで", category: "idea" },
  { surface: "練習", reading: "れんしゅう", category: "idea" },
  { surface: "予定", reading: "よてい", category: "idea" },
  { surface: "失敗", reading: "しっぱい", category: "idea" },
  { surface: "発見", reading: "はっけん", category: "idea" },
  { surface: "勇気", reading: "ゆうき", category: "idea" },
  { surface: "休憩", reading: "きゅうけい", category: "idea" },
  { surface: "夢", reading: "ゆめ", category: "idea" },
  { surface: "選択", reading: "せんたく", category: "idea" },
  { surface: "ありがとう", reading: "ありがとう", category: "idea" },
  { surface: "切手", reading: "きって", category: "object" },
  { surface: "小道", reading: "こみち", category: "place" },
  { surface: "夕焼け", reading: "ゆうやけ", category: "time" },
  { surface: "拍手", reading: "はくしゅ", category: "action" },
  { surface: "封筒", reading: "ふうとう", category: "object" },
  { surface: "散歩", reading: "さんぽ", category: "action" }
];

const categoryProfiles: Record<Exclude<WordCategory, "unknown">, CategoryProfile> = {
  person: {
    semantic_type: "person_reference",
    part_of_speech: "noun",
    user_stance: "neutral",
    character_stance: "curious",
    emotion_tags: ["curious", "neutral"],
    situation_tags: ["daily_talk", "memory"],
    relation_tags: ["who", "social"],
    affordances: ["ask_who", "recall_memory", "daily_talk"]
  },
  place: {
    semantic_type: "location",
    part_of_speech: "noun",
    user_stance: "neutral",
    character_stance: "curious",
    emotion_tags: ["curious", "happy"],
    situation_tags: ["room", "memory"],
    relation_tags: ["where", "scene"],
    affordances: ["ask_where", "diary_scene", "recall_place"]
  },
  food: {
    semantic_type: "food",
    part_of_speech: "noun",
    user_stance: "like",
    character_stance: "likes",
    emotion_tags: ["happy", "curious"],
    situation_tags: ["daily_talk", "diary"],
    relation_tags: ["meal", "daily"],
    affordances: ["ask_taste", "daily_talk", "diary_topic"]
  },
  object: {
    semantic_type: "thing",
    part_of_speech: "noun",
    user_stance: "neutral",
    character_stance: "curious",
    emotion_tags: ["curious", "neutral"],
    situation_tags: ["room", "daily_talk"],
    relation_tags: ["item", "nearby"],
    affordances: ["ask_use", "room_observation", "daily_talk"]
  },
  action: {
    semantic_type: "action",
    part_of_speech: "verb",
    user_stance: "neutral",
    character_stance: "curious",
    emotion_tags: ["curious", "proud"],
    situation_tags: ["daily_talk", "event"],
    relation_tags: ["do", "habit"],
    affordances: ["ask_when", "event_prompt", "habit_talk"]
  },
  feeling: {
    semantic_type: "emotion",
    part_of_speech: "adjective",
    user_stance: "neutral",
    character_stance: "curious",
    emotion_tags: ["curious", "embarrassed"],
    situation_tags: ["question", "diary"],
    relation_tags: ["feeling", "mood"],
    affordances: ["ask_feeling", "diary_mood", "correction_prompt"]
  },
  time: {
    semantic_type: "time",
    part_of_speech: "noun",
    user_stance: "neutral",
    character_stance: "curious",
    emotion_tags: ["neutral", "curious"],
    situation_tags: ["daily_talk", "diary"],
    relation_tags: ["when", "schedule"],
    affordances: ["ask_when", "diary_timing", "recall_time"]
  },
  idea: {
    semantic_type: "abstract_idea",
    part_of_speech: "noun",
    user_stance: "neutral",
    character_stance: "curious",
    emotion_tags: ["curious", "proud"],
    situation_tags: ["memory", "question"],
    relation_tags: ["idea", "meaning"],
    affordances: ["ask_meaning", "reflect", "diary_topic"]
  }
};

export const DEBUG_WORD_SEED_COUNT = seedEntries.length;

export function createDebugWordSeed(existingWords: WordFrame[] = []): WordFrame[] {
  const existingSurfaces = new Set(existingWords.map((word) => word.surface));
  const baseMs = Date.UTC(2026, 0, 1, 9, 0, 0);

  const words = seedEntries.map((entry, index) => {
    const profile = categoryProfiles[entry.category];
    const id = `debug_word_${String(index + 1).padStart(3, "0")}`;
    const createdAt = new Date(baseMs + index * 60 * 60 * 1000).toISOString();
    const lastUsedAt = index % 4 === 0 ? new Date(baseMs + (index + 24) * 60 * 60 * 1000).toISOString() : undefined;
    const confidence = Number(Math.min(0.95, 0.42 + (index % 11) * 0.045).toFixed(2));

    return {
      id,
      surface: entry.surface,
      reading: entry.reading,
      category: entry.category,
      semantic_type: profile.semantic_type,
      part_of_speech: profile.part_of_speech,
      user_stance: profile.user_stance,
      character_stance: profile.character_stance,
      emotion_tags: varyEmotions(profile.emotion_tags, index),
      situation_tags: varySituations(profile.situation_tags, index),
      relation_tags: [...profile.relation_tags],
      affordances: [...profile.affordances],
      related_word_ids: [],
      confidence,
      memory_strength: Number(Math.min(0.9, 0.2 + (index % 8) * 0.09).toFixed(2)),
      favorite_score: Number(Math.min(0.8, (index % 9) * 0.09).toFixed(2)),
      ambiguity_score: Number(Math.min(0.9, 0.1 + (index % 10) * 0.08).toFixed(2)),
      drift_level: (index % 4) as WordFrame["drift_level"],
      taught_by_user: true,
      source_question_ids: ["debug_seed_category", "debug_seed_emotion", "debug_seed_situation"],
      use_count: index % 8,
      review_count: index % 4,
      correction_count: index % 3,
      ...(lastUsedAt ? { last_used_at: lastUsedAt } : {}),
      created_at: createdAt,
      updated_at: createdAt,
      is_sensitive: false,
      is_blocked: false,
      notes: `debug seed: ${profile.semantic_type} / ${profile.affordances.join(", ")}`
    } satisfies WordFrame;
  });

  const byCategory = new Map<WordCategory, WordFrame[]>();
  for (const word of words) {
    const bucket = byCategory.get(word.category) ?? [];
    bucket.push(word);
    byCategory.set(word.category, bucket);
  }

  for (const bucket of byCategory.values()) {
    bucket.forEach((word, index) => {
      const related = [bucket[index - 1], bucket[index + 1]].filter(Boolean).map((item) => item.id);
      word.related_word_ids = related;
    });
  }

  return words.filter((word) => !existingSurfaces.has(word.surface));
}

function varyEmotions(base: EmotionTag[], index: number): EmotionTag[] {
  if (index % 6 === 0 && !base.includes("sleepy")) return [...base, "sleepy"];
  if (index % 5 === 0 && !base.includes("happy")) return [...base, "happy"];
  return [...base];
}

function varySituations(base: SituationTag[], index: number): SituationTag[] {
  if (index % 7 === 0 && !base.includes("event")) return [...base, "event"];
  if (index % 5 === 0 && !base.includes("room")) return [...base, "room"];
  return [...base];
}
