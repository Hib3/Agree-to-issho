import type { DialogueContext, SpeechAct, WordFrame } from "../../types/domain";
import { systemRandom, weightedPick, type RandomSource } from "./random";

export type DialogueState =
  | "idle"
  | "greeting"
  | "ask_new_word"
  | "recall_word"
  | "drift_talk"
  | "ask_correction"
  | "review_prompt"
  | "preference_check"
  | "relation_check"
  | "situation_check"
  | "diary_prompt"
  | "lonely_reaction"
  | "sleepy_reaction"
  | "goodbye";

export type StateCandidate = { state: DialogueState; weight: number; reasons: string[] };
export type StateSelection = { state: DialogueState; candidates: StateCandidate[]; relaxed: string[] };

export function chooseNextState(context: DialogueContext, random: RandomSource = systemRandom): DialogueState {
  return chooseNextStateWithDebug(context, random).state;
}

export function chooseNextStateWithDebug(context: DialogueContext, random: RandomSource = systemRandom): StateSelection {
  if (context.conversation_session && context.conversation_session.phase !== "completed") {
    return { state: "idle", candidates: [{ state: "idle", weight: 1, reasons: ["active_session"] }], relaxed: [] };
  }
  const usableWords = getUsableWords(context.words);
  if (usableWords.length === 0) return { state: "ask_new_word", candidates: [], relaxed: [] };

  const logs = characterLogs(context).slice(-12);
  const hour = new Date(context.now).getHours();
  const lowUnderstanding = usableWords.filter((word) => word.confidence < 0.58 || word.ambiguity_score > 0.72);
  const relationReady = usableWords.filter((word) => word.related_word_ids.length > 0).length >= 2 || usableWords.length >= 4;
  const candidates: StateCandidate[] = [];
  const add = (state: DialogueState, weight: number, ...reasons: string[]) => candidates.push({ state, weight, reasons });

  if (logs.length === 0 && usableWords.every((word) => word.use_count === 0)) add("greeting", 8, "first_character_log");
  add("recall_word", usableWords.some((word) => word.use_count === 0) ? 7 : 4, "learned_words");
  add("preference_check", usableWords.some((word) => word.category === "food" || word.user_stance === "unknown") ? 5 : 1.5, "preference_candidate");
  add("situation_check", usableWords.some((word) => word.situation_tags.length === 0 || word.situation_tags.includes("unknown")) ? 5 : 2, "situation_candidate");
  if (relationReady) add("relation_check", 3.5, "relation_candidates");
  if (lowUnderstanding.length > 0) {
    add("review_prompt", 6, "low_confidence");
    add("ask_correction", 3, "ambiguous_word");
  }
  if (usableWords.length >= 10 && hasDriftCandidate(usableWords) && !logs.slice(-5).some((log) => log.semantic_key === "drift.word.misuse")) {
    add("drift_talk", 2.5, "drift_candidate");
  }
  if (hasDiaryPrompt(context)) add("diary_prompt", 1.5, "diary_available");
  if (isAwayForDays(context, 3)) add("lonely_reaction", 7, "away_three_days");
  if (hour >= 23 || hour < 5) add("sleepy_reaction", 5, "late_hour");
  add("idle", context.character_state?.energy !== undefined && context.character_state.energy < 25 ? 5 : 2.5, "daily_talk");
  if (logs.length >= 6 && logs.slice(-5).every((log) => isToday(log.created_at, context.now))) add("goodbye", 1.2, "long_session");

  const recentActs = logs.map((log) => log.speech_act).filter(Boolean);
  const cooled = candidates.map((candidate) => {
    const act = stateToSpeechAct(candidate.state);
    const lastTwo = recentActs.slice(-2);
    const repeated = lastTwo.length === 2 && lastTwo.every((item) => item === act);
    return { ...candidate, weight: repeated ? 0 : candidate.weight, reasons: repeated ? [...candidate.reasons, "speech_act_cooldown"] : candidate.reasons };
  });
  const selected = weightedPick(cooled.map((item) => ({ value: item.state, weight: item.weight })), random);
  if (selected) return { state: selected, candidates: cooled, relaxed: [] };
  const relaxed = weightedPick(candidates.map((item) => ({ value: item.state, weight: item.weight })), random);
  return { state: relaxed ?? "idle", candidates, relaxed: ["speech_act_cooldown"] };
}

export function stateToSpeechAct(state: DialogueState): SpeechAct {
  const map: Record<DialogueState, SpeechAct> = {
    idle: "use_word_in_daily_talk", greeting: "greeting", ask_new_word: "ask_new_word",
    recall_word: "recall_word", drift_talk: "misunderstanding_joke", ask_correction: "ask_correction",
    review_prompt: "ask_correction", preference_check: "ask_emotion", relation_check: "ask_relation",
    situation_check: "ask_situation", diary_prompt: "diary_entry", lonely_reaction: "lonely_reaction",
    sleepy_reaction: "sleepy_reaction", goodbye: "goodbye"
  };
  return map[state];
}

function characterLogs(context: DialogueContext) {
  return [...(context.dialogue_logs ?? [])].filter((log) => !log.role || log.role === "character").sort((a, b) => a.created_at.localeCompare(b.created_at));
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
  return logs.some((log) => log.used_word_ids.length > 0 && isToday(log.created_at, context.now))
    && !diaries.some((entry) => entry.entry_date === context.now.slice(0, 10));
}

function isAwayForDays(context: DialogueContext, days: number) {
  const lastSeen = context.character_state?.last_user_interaction_at ?? context.character_state?.last_interaction_at;
  if (!lastSeen) return false;
  return new Date(context.now).getTime() - new Date(lastSeen).getTime() >= days * 86400000;
}

function isToday(iso: string, now: string) {
  return iso.slice(0, 10) === now.slice(0, 10);
}
