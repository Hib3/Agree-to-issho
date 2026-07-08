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
    id: "ask_correction_low_confidence",
    speech_act: "ask_correction",
    text: "「{word}」は {category} として覚えてるけど、{situation} に出しても合っていますか？",
    intent: "correction",
    word_slot: {},
    expression: "confused"
  },
  {
    id: "ask_correction_emotion",
    speech_act: "ask_correction",
    text: "「{word}」は {emotion} で覚えています。もし違ったら、あとで直してください。",
    intent: "correction",
    word_slot: {},
    expression: "thinking"
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
