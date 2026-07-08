import type { SpeechAct, WordCategory } from "../../types/domain";

export type HiddenConversationSlot = {
  id: string;
  speech_act: SpeechAct;
  purpose: "ask" | "answer" | "recall" | "confirm" | "repair";
  accepts_word_category?: WordCategory;
  max_user_words: 0 | 1;
};

export const hiddenConversationLexicon: HiddenConversationSlot[] = [
  { id: "word_request", speech_act: "ask_new_word", purpose: "ask", max_user_words: 0 },
  { id: "category_request", speech_act: "ask_category", purpose: "ask", max_user_words: 1 },
  { id: "emotion_request", speech_act: "ask_emotion", purpose: "ask", max_user_words: 1 },
  { id: "situation_request", speech_act: "ask_situation", purpose: "ask", max_user_words: 1 },
  { id: "meaning_confirm", speech_act: "confirm_meaning", purpose: "confirm", max_user_words: 1 },
  { id: "memory_recall_any", speech_act: "recall_word", purpose: "recall", max_user_words: 1 },
  { id: "daily_place", speech_act: "use_word_in_daily_talk", purpose: "recall", accepts_word_category: "place", max_user_words: 1 },
  { id: "daily_feeling", speech_act: "use_word_in_daily_talk", purpose: "recall", accepts_word_category: "feeling", max_user_words: 1 },
  { id: "low_confidence_repair", speech_act: "ask_correction", purpose: "repair", max_user_words: 1 }
];

export function getHiddenSlotsForSpeechAct(speechAct: SpeechAct): HiddenConversationSlot[] {
  return hiddenConversationLexicon.filter((slot) => slot.speech_act === speechAct);
}
