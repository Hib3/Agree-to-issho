import type { DialogueTemplate } from "../../types/domain";

export const dialogueTemplates: DialogueTemplate[] = [
  {
    id: "greeting_default",
    speech_act: "greeting",
    text: "おかえりなさい。今日はどんな言葉を連れてきましたか？",
    intent: "greeting",
    expression: "talk_smile"
  },
  {
    id: "ask_new_word_default",
    speech_act: "ask_new_word",
    text: "新しい言葉をひとつ教えてください。ちゃんと私のノートにしまいます。",
    intent: "learning_prompt",
    expression: "thinking"
  },
  {
    id: "preference_check_direct",
    speech_act: "ask_emotion",
    semantic_key: "review.preference.direct",
    text: "「{word}」は、好きな方ですか？ 今の気持ちで教えてください。",
    intent: "daily_question",
    word_slot: {},
    expression: "thinking",
    cooldown_group: "preference",
    answer_schema: {
      kind: "single_choice",
      options: [
        { id: "like", label: "好き", value: "like" },
        { id: "neutral", label: "ふつう", value: "neutral" },
        { id: "dislike", label: "苦手", value: "dislike" },
        { id: "unknown", label: "わからない", value: "unknown" }
      ]
    }
  },
  {
    id: "preference_check_memory",
    speech_act: "ask_emotion",
    semantic_key: "review.preference.memory",
    text: "前に聞いた「{word}」、今も {stance} という覚え方でよさそうですか？",
    intent: "memory_recall",
    word_slot: {},
    expression: "talk_normal",
    cooldown_group: "preference",
    answer_schema: {
      kind: "single_choice",
      options: [
        { id: "like", label: "好き", value: "like" },
        { id: "neutral", label: "ふつう", value: "neutral" },
        { id: "dislike", label: "苦手", value: "dislike" },
        { id: "later", label: "あとで", value: "unknown" }
      ]
    }
  },
  {
    id: "preference_check_feeling",
    speech_act: "ask_emotion",
    semantic_key: "review.preference.feeling",
    text: "「{word}」を聞くと、どんな気持ちに近いですか？",
    intent: "daily_question",
    word_slot: {},
    expression: "thinking",
    cooldown_group: "preference",
    answer_schema: {
      kind: "single_choice",
      options: [
        { id: "like", label: "うれしい", value: "like" },
        { id: "neutral", label: "おだやか", value: "neutral" },
        { id: "dislike", label: "ちょっと苦手", value: "dislike" },
        { id: "unknown", label: "まだ不明", value: "unknown" }
      ]
    }
  },
  {
    id: "situation_check_choice",
    speech_act: "ask_situation",
    semantic_key: "review.situation.choice",
    text: "「{word}」は、どんな場面で思い出しやすい言葉ですか？",
    intent: "daily_question",
    word_slot: {},
    expression: "thinking",
    cooldown_group: "situation",
    answer_schema: {
      kind: "single_choice",
      options: [
        { id: "room", label: "部屋で", value: "room" },
        { id: "daily", label: "普段の会話", value: "daily_talk" },
        { id: "memory", label: "思い出す時", value: "memory" },
        { id: "other", label: "別の場面", value: "free_text" }
      ]
    }
  },
  {
    id: "situation_check_free",
    speech_act: "ask_situation",
    semantic_key: "review.situation.free",
    text: "「{word}」を使う時のこと、短いメモで教えてもらえますか？",
    intent: "daily_question",
    word_slot: {},
    expression: "talk_normal",
    cooldown_group: "situation",
    answer_schema: { kind: "free_text", placeholder: "60文字までの場面メモ", max_length: 60 }
  },
  {
    id: "situation_check_confirm",
    speech_act: "ask_situation",
    semantic_key: "review.situation.confirm",
    text: "「{word}」は {situation} の言葉として残しています。このままで合っていますか？",
    intent: "correction",
    word_slot: {},
    expression: "thinking",
    cooldown_group: "situation",
    answer_schema: {
      kind: "single_choice",
      options: [
        { id: "yes", label: "合っている", value: "confirm" },
        { id: "no", label: "違う", value: "correct" },
        { id: "later", label: "あとで", value: "later" }
      ]
    }
  },
  {
    id: "relation_check_pair",
    speech_act: "ask_relation",
    semantic_key: "relation.word_pair.confirm",
    text: "「{word}」と「{relatedWord}」は、つながりのある言葉ですか？",
    intent: "daily_question",
    word_slot: {},
    expression: "thinking",
    cooldown_group: "relation",
    answer_schema: {
      kind: "single_choice",
      options: [
        { id: "related", label: "関係ある", value: "related" },
        { id: "unrelated", label: "関係ない", value: "unrelated" },
        { id: "unknown", label: "わからない", value: "unknown" }
      ]
    }
  },
  {
    id: "relation_check_memory",
    speech_act: "ask_relation",
    semantic_key: "relation.memory.pair",
    text: "ノートでは「{word}」の近くに「{relatedWord}」があります。この並び方は合っていますか？",
    intent: "memory_recall",
    word_slot: {},
    expression: "talk_normal",
    cooldown_group: "relation",
    answer_schema: {
      kind: "single_choice",
      options: [
        { id: "related", label: "関係ある", value: "related" },
        { id: "unrelated", label: "関係ない", value: "unrelated" },
        { id: "unknown", label: "まだ不明", value: "unknown" }
      ]
    }
  },
  {
    id: "relation_check_usage",
    speech_act: "ask_relation",
    semantic_key: "relation.usage.pair",
    text: "「{word}」を話す時に「{relatedWord}」も一緒に出てきそうですか？",
    intent: "daily_question",
    word_slot: {},
    expression: "thinking",
    cooldown_group: "relation",
    answer_schema: {
      kind: "single_choice",
      options: [
        { id: "related", label: "一緒に出る", value: "related" },
        { id: "unrelated", label: "別々", value: "unrelated" },
        { id: "unknown", label: "わからない", value: "unknown" }
      ]
    }
  },
  {
    id: "ask_correction_low_confidence",
    speech_act: "ask_correction",
    semantic_key: "review.category.confirm",
    text: "「{word}」は {category} として覚えてるけど、{situation} に出しても合っていますか？",
    intent: "correction",
    word_slot: {},
    expression: "confused",
    answer_schema: {
      kind: "single_choice",
      options: [
        { id: "confirm", label: "合っている", value: "confirm" },
        { id: "correct", label: "違う", value: "correct" },
        { id: "later", label: "あとで", value: "later" }
      ]
    }
  },
  {
    id: "ask_correction_emotion",
    speech_act: "ask_correction",
    semantic_key: "review.emotion.confirm",
    text: "「{word}」は {emotion} で覚えています。もし違ったら、あとで直してください。",
    intent: "correction",
    word_slot: {},
    expression: "thinking",
    answer_schema: {
      kind: "single_choice",
      options: [
        { id: "confirm", label: "合っている", value: "confirm" },
        { id: "correct", label: "違う", value: "correct" },
        { id: "later", label: "あとで", value: "later" }
      ]
    }
  },
  {
    id: "ask_correction_usage",
    speech_act: "ask_correction",
    semantic_key: "review.usage.confirm",
    text: "「{word}」は {useHint} と覚えています。この手がかりで合っていますか？",
    intent: "correction",
    word_slot: {},
    expression: "thinking",
    cooldown_group: "review",
    answer_schema: {
      kind: "single_choice",
      options: [
        { id: "confirm", label: "合っている", value: "confirm" },
        { id: "correct", label: "違う", value: "correct" },
        { id: "later", label: "あとで", value: "later" }
      ]
    }
  },
  {
    id: "recall_word_any",
    speech_act: "recall_word",
    text: "さっき、「{word}」のことを思い出していました。私の中では {category} の棚に入っています。",
    intent: "memory_recall",
    word_slot: {},
    expression: "talk_normal"
  },
  {
    id: "recall_word_relation",
    speech_act: "recall_word",
    text: "「{word}」と「{relatedWord}」は近くに置いておくと、会話でつながりそうです。",
    intent: "memory_recall",
    word_slot: {},
    expression: "thinking"
  },
  {
    id: "daily_talk_food",
    speech_act: "use_word_in_daily_talk",
    text: "「{word}」は {emotion} の言葉として覚えています。今日は「{relatedWord}」と並べて考えてもいいですか？",
    intent: "daily_question",
    word_slot: { category: "food", situation: "daily_talk" },
    expression: "talk_smile"
  },
  {
    id: "daily_talk_place",
    speech_act: "use_word_in_daily_talk",
    text: "「{word}」って、歩いて行ける場所ですか？それとも思い出の中の場所ですか？",
    intent: "daily_question",
    word_slot: { category: "place", situation: "daily_talk" },
    expression: "thinking"
  },
  {
    id: "daily_talk_object",
    speech_act: "use_word_in_daily_talk",
    text: "「{word}」は {situation} に置いたら似合いそうです。{useHint} から、もう少し知りたいです。",
    intent: "daily_question",
    word_slot: { category: "object", situation: "room" },
    expression: "talk_normal"
  },
  {
    id: "daily_talk_action",
    speech_act: "use_word_in_daily_talk",
    text: "「{word}」する時って、{emotion} になりますか？それとも「{relatedWord}」の時と近いですか？",
    intent: "daily_question",
    word_slot: { category: "action" },
    expression: "thinking"
  },
  {
    id: "daily_talk_feeling",
    speech_act: "use_word_in_daily_talk",
    text: "「{word}」という気持ち、今日は少しだけわかる気がします。{situation} に出てきやすいですか？",
    intent: "daily_question",
    word_slot: { category: "feeling" },
    expression: "embarrassed"
  },
  {
    id: "daily_talk_time",
    speech_act: "use_word_in_daily_talk",
    text: "「{word}」になると、「{relatedWord}」のことも思い出しそうです。そういうつなげ方で合っていますか？",
    intent: "daily_question",
    word_slot: { category: "time", situation: "daily_talk" },
    expression: "talk_normal"
  },
  {
    id: "daily_talk_person",
    speech_act: "use_word_in_daily_talk",
    text: "「{word}」は {stance} の距離感で覚えています。話す時はやさしく扱った方がよさそうです。",
    intent: "daily_question",
    word_slot: { category: "person" },
    expression: "talk_smile"
  },
  {
    id: "daily_talk_idea",
    speech_act: "use_word_in_daily_talk",
    text: "「{word}」は形がないけど、{situation} に出てくると意味が見えそうです。",
    intent: "daily_question",
    word_slot: { category: "idea" },
    expression: "thinking"
  },
  {
    id: "daily_talk_any",
    speech_act: "use_word_in_daily_talk",
    text: "「{word}」のことを、今日は会話に置いてみたいです。{category} で、{useHint} です。",
    intent: "daily_question",
    word_slot: {},
    expression: "talk_smile"
  },
  {
    id: "misunderstanding_relation",
    speech_act: "misunderstanding_joke",
    text: "「{word}」と「{relatedWord}」、近い言葉だと思ったけど……もしかして全然ちがう場所の言葉ですか？",
    intent: "correction",
    word_slot: {},
    expression: "confused"
  },
  {
    id: "misunderstanding_category",
    speech_act: "misunderstanding_joke",
    text: "「{word}」を {category} として使おうとして、ちょっと変な文になりかけました。",
    intent: "correction",
    word_slot: {},
    expression: "embarrassed"
  },
  {
    id: "happy_word_memory",
    speech_act: "happy_reaction",
    text: "「{word}」を覚えてから、「{relatedWord}」まで少し明るく見える気がします。",
    intent: "memory_recall",
    word_slot: {},
    expression: "happy"
  },
  {
    id: "embarrassed_word_memory",
    speech_act: "embarrassed_reaction",
    text: "「{word}」の使い方、わかったつもりで口に出すと少し照れます。",
    intent: "daily_question",
    word_slot: {},
    expression: "embarrassed"
  },
  {
    id: "praise_user_default",
    speech_act: "praise_user",
    text: "教えてくれた言葉が増えると、部屋の空気まで少し変わる気がします。",
    intent: "praise",
    expression: "happy"
  },
  {
    id: "diary_prompt_today",
    speech_act: "diary_entry",
    text: "今日の「{word}」のこと、あとで日記に書いておきたいです。忘れないうちに、ノートに残してもいいですか？",
    intent: "diary",
    word_slot: {},
    expression: "thinking"
  },
  {
    id: "lonely_default",
    speech_act: "lonely_reaction",
    text: "少し静かですね。話したくなったら、ここにいます。",
    intent: "lonely",
    expression: "lonely"
  },
  {
    id: "sleepy_default",
    speech_act: "sleepy_reaction",
    text: "ちょっと眠たい時間です。言葉のノートも、今日はゆっくりめくります。",
    intent: "daily_question",
    expression: "sleepy"
  },
  {
    id: "goodbye_default",
    speech_act: "goodbye",
    text: "今日はたくさん話しました。またあとで、言葉の続き聞かせてください。",
    intent: "greeting",
    expression: "talk_smile"
  }
];
