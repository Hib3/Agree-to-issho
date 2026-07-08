import type { DialogueContext, SpeechAct, WordFrame } from "../../types/domain";

export type DialogueState =
  | "idle"
  | "greeting"
  | "ask_new_word"
  | "recall_word"
  | "drift_talk"
  | "ask_correction"
  | "review_prompt"
  | "diary_prompt"
  | "lonely_reaction"
  | "sleepy_reaction"
  | "goodbye";

export function chooseNextState(context: DialogueContext): DialogueState {
  const usableWords = getUsableWords(context.words);
  if (usableWords.length === 0) return "ask_new_word";

  const recentLogs = [...(context.dialogue_logs ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const hour = new Date(context.now).getHours();
  const lowUnderstanding = usableWords.filter((word) => word.confidence < 0.58 || word.ambiguity_score > 0.72);
  const totalUses = usableWords.reduce((sum, word) => sum + word.use_count, 0);
  const seed = totalUses + usableWords.length + recentLogs.length + hour;

  if (recentLogs.length === 0 && totalUses === 0) return "greeting";
  if (isAwayForDays(context, 3)) return "lonely_reaction";
  if (hour >= 23 || hour < 5) {
    if (seed % 3 !== 0) return "sleepy_reaction";
  }
  if (recentLogs.length >= 5 && recentLogs.slice(0, 5).every((log) => isToday(log.created_at, context.now))) {
    if (seed % 6 === 0) return "goodbye";
  }
  if (lowUnderstanding.length > 0 && seed % 4 === 0) return "review_prompt";
  if (lowUnderstanding.length > 0 && seed % 5 === 0) return "ask_correction";
  if (hasDiaryPrompt(context) && seed % 7 === 0) return "diary_prompt";
  if (usableWords.length >= 10 && hasDriftCandidate(usableWords) && seed % 3 === 0) return "drift_talk";
  if (usableWords.some((word) => word.use_count === 0) || seed % 2 === 0) return "recall_word";
  return "idle";
}

export function stateToSpeechAct(state: DialogueState): SpeechAct {
  const map: Record<DialogueState, SpeechAct> = {
    idle: "use_word_in_daily_talk",
    greeting: "greeting",
    ask_new_word: "ask_new_word",
    recall_word: "recall_word",
    drift_talk: "misunderstanding_joke",
    ask_correction: "ask_correction",
    review_prompt: "ask_correction",
    diary_prompt: "diary_entry",
    lonely_reaction: "lonely_reaction",
    sleepy_reaction: "sleepy_reaction",
    goodbye: "goodbye"
  };
  return map[state];
}

function getUsableWords(words: WordFrame[]) {
  return words.filter((word) => !word.is_blocked && !word.is_sensitive && !word.forgotten_at);
}

function hasDriftCandidate(words: WordFrame[]) {
  return words.some((word) => word.drift_level > 0 && (word.confidence < 0.75 || word.ambiguity_score > 0.55));
}

function hasDiaryPrompt(context: DialogueContext) {
  const logs = context.dialogue_logs ?? [];
  const diaries = context.diary_entries ?? [];
  const talkedToday = logs.some((log) => log.used_word_ids.length > 0 && isToday(log.created_at, context.now));
  const wroteToday = diaries.some((entry) => entry.entry_date === context.now.slice(0, 10));
  return talkedToday && !wroteToday;
}

function isAwayForDays(context: DialogueContext, days: number) {
  const lastSeen = context.character_state?.last_interaction_at;
  if (!lastSeen) return false;
  const elapsed = new Date(context.now).getTime() - new Date(lastSeen).getTime();
  return elapsed >= days * 24 * 60 * 60 * 1000;
}

function isToday(iso: string, now: string) {
  return iso.slice(0, 10) === now.slice(0, 10);
}
