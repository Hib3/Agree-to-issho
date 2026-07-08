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
    text: "{word} の意味を、もう少し教えてください。",
    intent: "correction",
    word_slot: {},
    expression: "confused"
  },
  {
    id: "recall_word_any",
    speech_act: "recall_word",
    text: "さっき、{word} のことを思い出していました。",
    intent: "memory_recall",
    word_slot: {},
    expression: "talk_normal"
  },
  {
    id: "daily_talk_place",
    speech_act: "use_word_in_daily_talk",
    text: "{word} って、歩いて行ける場所ですか？それとも心の中の場所？",
    intent: "daily_question",
    word_slot: { category: "place", situation: "daily_talk" },
    expression: "thinking"
  },
  {
    id: "daily_talk_feeling",
    speech_act: "use_word_in_daily_talk",
    text: "{word} という気持ち、今日は少しだけわかる気がします。",
    intent: "daily_question",
    word_slot: { category: "feeling" },
    expression: "embarrassed"
  },
  {
    id: "daily_talk_any",
    speech_act: "use_word_in_daily_talk",
    text: "{word} のことを、今日は会話に置いてみたいです。",
    intent: "daily_question",
    word_slot: {},
    expression: "talk_smile"
  },
  {
    id: "praise_user_default",
    speech_act: "praise_user",
    text: "教えてくれた言葉が増えると、部屋の空気まで少し変わる気がします。",
    intent: "praise",
    expression: "happy"
  },
  {
    id: "lonely_default",
    speech_act: "lonely_reaction",
    text: "少し静かですね。話したくなったら、ここにいます。",
    intent: "lonely",
    expression: "lonely"
  }
];
