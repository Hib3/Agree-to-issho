import { dialogueTemplates } from "../../data/templates/dialogueTemplates";
import { generateDiaryEntryFromContext } from "../diary/generateDiaryEntry";
import { createWordFrame } from "../word/createWordFrame";
import type { DialogueContext, DialogueLog, DialogueTemplate, DialogueTurn, DiaryEntry, SpeechAct, WordFrame } from "../../types/domain";
import type { DialogueEngine } from "./DialogueEngine";
import { applyAguriStyle } from "./applyAguriStyle";
import { chooseDriftMode, createDriftTemplate } from "./drift";
import { getEmotionCode, getMotionHint } from "./emotionMapping";
import { systemRandom, weightedPick, type RandomSource } from "./random";
import { renderTemplate } from "./renderTemplate";
import { chooseNextStateWithDebug, stateToSpeechAct, type StateSelection } from "./stateMachine";
import { getWordScoreDebug, selectWordForTemplate } from "./wordScoring";

export type DialogueDebugInfo = {
  state: StateSelection;
  selected_template_id: string;
  semantic_key: string;
  excluded_templates: Array<{ id: string; reason: string }>;
  word_candidates: ReturnType<typeof getWordScoreDebug>;
  selected_word?: { id: string; surface: string; score?: number; weight?: number };
  relaxed_constraints: string[];
};

export class TemplateDialogueEngine implements DialogueEngine {
  lastDebug: DialogueDebugInfo | null = null;

  constructor(private readonly random: RandomSource = systemRandom) {}

  next(context: DialogueContext): DialogueTurn {
    const characterLogs = (context.dialogue_logs ?? []).filter((log) => !log.role || log.role === "character");
    const turnIndex = characterLogs.length;
    const state = chooseNextStateWithDebug(context, this.random);
    const speechAct = stateToSpeechAct(state.state);
    const selection = chooseTemplate(speechAct, context, this.random);
    const template = selection.template;
    const word = needsWord(template)
      ? selectWordForTemplate(context.words, template, context.now, characterLogs, this.random)
      : null;
    const finalTemplate = speechAct === "misunderstanding_joke" && word
      ? { ...createDriftTemplate(word, chooseDriftMode(word, context)), semantic_key: "drift.word.misuse", cooldown_group: "drift" }
      : template;
    const renderedText = renderTemplate(finalTemplate, word, context.words);
    const emotionCode = getEmotionCode(finalTemplate.speech_act, finalTemplate.expression);
    const semanticKey = finalTemplate.semantic_key ?? semanticKeyFor(finalTemplate);
    const sessionId = `session_${crypto.randomUUID()}`;
    const usedWords = word ? [word] : [];
    if (speechAct === "ask_relation" && word) {
      const recentWordIds = new Set(characterLogs.slice(-3).flatMap((log) => log.used_word_ids));
      const related = context.words.find((item) => item.id !== word.id && !recentWordIds.has(item.id) && !item.is_blocked && !item.is_sensitive && (word.related_word_ids.includes(item.id) || item.category === word.category));
      if (related) usedWords.push(related);
    }
    const styledText = applyAguriStyle({
      template: finalTemplate,
      renderedText,
      speechAct: finalTemplate.speech_act,
      word,
      turnIndex,
      recentTexts: characterLogs.slice(-3).map((log) => log.text)
    });
    const relaxed = [...state.relaxed, ...selection.relaxed];
    if (characterLogs.slice(-8).some((log) => log.template_id === finalTemplate.id) && !relaxed.includes("template_id_cooldown")) {
      relaxed.push("template_id_cooldown");
    }
    if (characterLogs.slice(-5).some((log) => log.semantic_key === semanticKey) && !relaxed.includes("semantic_key_cooldown")) {
      relaxed.push("semantic_key_cooldown");
    }
    const recentWordIds = new Set(characterLogs.slice(-3).flatMap((log) => log.used_word_ids));
    if (usedWords.some((item) => recentWordIds.has(item.id))) relaxed.push("word_id_cooldown");
    const recentCategories = characterLogs.slice(-2).map((log) => context.words.find((item) => log.used_word_ids.includes(item.id))?.category).filter(Boolean);
    if (word && recentCategories.length === 2 && recentCategories.every((category) => category === word.category)) relaxed.push("word_category_cooldown");

    const wordCandidates = getWordScoreDebug(context.words, finalTemplate, context.now, characterLogs);
    const selectedWordDebug = word ? wordCandidates.find((item) => item.word_id === word.id) : undefined;

    this.lastDebug = {
      state,
      selected_template_id: finalTemplate.id,
      semantic_key: semanticKey,
      excluded_templates: selection.excluded,
      word_candidates: wordCandidates,
      ...(word ? { selected_word: { id: word.id, surface: word.surface, score: selectedWordDebug?.score, weight: selectedWordDebug?.weight } } : {}),
      relaxed_constraints: relaxed
    };

    return {
      speech_act: finalTemplate.speech_act,
      text: avoidExactRepeat(styledText, characterLogs),
      expression: finalTemplate.expression,
      emotion_code: emotionCode,
      motion_hint: finalTemplate.motion_hint ?? getMotionHint(emotionCode),
      used_words: usedWords,
      template_id: finalTemplate.id,
      semantic_key: semanticKey,
      session_id: sessionId,
      requires_answer: Boolean(finalTemplate.answer_schema),
      ...(finalTemplate.answer_schema ? { answer_schema: finalTemplate.answer_schema } : {}),
      ...(relaxed.length ? { relaxed_constraints: relaxed } : {})
    };
  }

  async teachWord(input: string): Promise<WordFrame> {
    return createWordFrame(input);
  }

  async answerQuestion(_questionId: string, _answer: string): Promise<WordFrame> {
    throw new Error("回答は保存済み会話セッションで処理します。");
  }

  async correctWord(wordId: string, patch: Partial<WordFrame>): Promise<WordFrame> {
    return { ...patch, id: wordId } as WordFrame;
  }

  async generateDiaryEntry(context: DialogueContext): Promise<DiaryEntry> {
    return generateDiaryEntryFromContext(context);
  }
}

function chooseTemplate(speechAct: SpeechAct, context: DialogueContext, random: RandomSource) {
  const all = dialogueTemplates.filter((template) => template.speech_act === speechAct);
  const candidates = all.length > 0 ? all : dialogueTemplates.filter((template) => template.speech_act === "use_word_in_daily_talk");
  const logs = (context.dialogue_logs ?? []).filter((log) => !log.role || log.role === "character");
  const recentTemplateIds = new Set(logs.slice(-8).map((log) => log.template_id).filter(Boolean));
  const recentSemanticKeys = new Set(logs.slice(-5).map((log) => log.semantic_key).filter(Boolean));
  const excluded: Array<{ id: string; reason: string }> = [];
  const wordUsable = candidates.filter((template) => {
    if (!needsWord(template)) return true;
    const usable = context.words.some((word) => isWordEligible(word, template));
    if (!usable) excluded.push({ id: template.id, reason: "no_matching_word" });
    return usable;
  });
  const strict = wordUsable.filter((template) => {
    const semanticKey = template.semantic_key ?? semanticKeyFor(template);
    if (recentTemplateIds.has(template.id)) {
      excluded.push({ id: template.id, reason: "template_cooldown" });
      return false;
    }
    if (recentSemanticKeys.has(semanticKey)) {
      excluded.push({ id: template.id, reason: "semantic_cooldown" });
      return false;
    }
    return true;
  });
  const relaxed: string[] = [];
  let pool = strict;
  if (pool.length === 0) {
    pool = wordUsable.filter((template) => !recentTemplateIds.has(template.id));
    relaxed.push("semantic_key_cooldown");
  }
  if (pool.length === 0) {
    pool = wordUsable;
    relaxed.push("template_id_cooldown");
  }
  if (pool.length === 0) pool = candidates;
  const template = weightedPick(pool.map((item) => ({ value: item, weight: 1 })), random) ?? dialogueTemplates[0];
  return { template, excluded, relaxed };
}

function needsWord(template: DialogueTemplate) {
  return Boolean(template.word_slot) || /\{(?:word|relatedWord|category|emotion|situation|stance)\}/.test(template.text);
}

function isWordEligible(word: WordFrame, template: DialogueTemplate) {
  if (word.is_blocked || word.is_sensitive || word.forgotten_at) return false;
  if (template.speech_act === "ask_emotion" && word.category !== "food" && word.user_stance !== "unknown") return false;
  if (template.word_slot?.category && word.category !== template.word_slot.category) return false;
  if (template.word_slot?.situation && !word.situation_tags.includes(template.word_slot.situation)) return false;
  return true;
}

function semanticKeyFor(template: DialogueTemplate) {
  return `${template.intent ?? "daily"}.${template.speech_act}.${template.word_slot?.category ?? "any"}`;
}

function avoidExactRepeat(text: string, logs: DialogueLog[]) {
  const signature = createSemanticSignature(text);
  if (!logs.slice(-8).some((log) => createSemanticSignature(log.text) === signature)) return text;
  const tails = [
    "今度は別の場面でも考えてみます。", "ノートの違うページにも残しておきます。",
    "前とは少し違うつながりを探してみます。", "今日はここから新しい意味を探します。",
    "同じ言葉でも、別の気持ちで見てみます。", "次は近くの言葉も一緒に考えます。",
    "この続きは、少し時間を置いて考えます。", "もう一つ違う覚え方を探しておきます。"
  ];
  return `${text}\n${tails[logs.length % tails.length]}`;
}

export function createSemanticSignature(text: string) {
  return text
    .normalize("NFKC")
    .replace(/^(?:まァっ|なんかっ|あのっそのっ)[、,]?/u, "")
    .replace(/[\s、。！？!?「」『』]/g, "")
    .trim();
}
