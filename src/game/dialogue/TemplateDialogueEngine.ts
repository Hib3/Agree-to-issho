import { dialogueTemplates } from "../../data/templates/dialogueTemplates";
import { generateDiaryEntryFromContext } from "../diary/generateDiaryEntry";
import { createWordFrame } from "../word/createWordFrame";
import type { DialogueContext, DialogueLog, DialogueTemplate, DialogueTurn, DiaryEntry, SpeechAct, WordFrame } from "../../types/domain";
import type { DialogueEngine } from "./DialogueEngine";
import { applyAguriStyle } from "./applyAguriStyle";
import { chooseDriftMode, createDriftTemplate } from "./drift";
import { getEmotionCode, getMotionHint } from "./emotionMapping";
import { renderTemplate } from "./renderTemplate";
import { chooseNextState, stateToSpeechAct } from "./stateMachine";
import { selectWordForTemplate } from "./wordScoring";

export class TemplateDialogueEngine implements DialogueEngine {
  next(context: DialogueContext): DialogueTurn {
    const turnIndex = context.words.reduce((sum, item) => sum + item.use_count, 0);
    const speechAct = stateToSpeechAct(chooseNextState(context));
    const template = chooseTemplate(speechAct, context.words, turnIndex, context.now, context.dialogue_logs ?? []);
    const word = template.word_slot || template.text.includes("{word}") ? selectWordForTemplate(context.words, template, context.now, context.dialogue_logs ?? []) : null;
    const finalTemplate = speechAct === "misunderstanding_joke" && word ? createDriftTemplate(word, chooseDriftMode(word, context)) : template;
    const renderedText = renderTemplate(finalTemplate, word, context.words);
    const emotionCode = getEmotionCode(finalTemplate.speech_act, finalTemplate.expression);
    return {
      speech_act: finalTemplate.speech_act,
      text: applyAguriStyle({ template: finalTemplate, renderedText, speechAct: finalTemplate.speech_act, word, turnIndex }),
      expression: finalTemplate.expression,
      emotion_code: emotionCode,
      motion_hint: getMotionHint(emotionCode),
      used_words: word ? [word] : []
    };
  }

  async teachWord(input: string): Promise<WordFrame> {
    return createWordFrame(input);
  }

  async answerQuestion(_questionId: string, _answer: string): Promise<WordFrame> {
    throw new Error("answerQuestion is handled by MeaningQuestionFlow in the MVP.");
  }

  async correctWord(wordId: string, patch: Partial<WordFrame>): Promise<WordFrame> {
    return {
      ...patch,
      id: wordId
    } as WordFrame;
  }

  async generateDiaryEntry(context: DialogueContext): Promise<DiaryEntry> {
    return generateDiaryEntryFromContext(context);
  }
}

function chooseTemplate(speechAct: SpeechAct, words: WordFrame[], turnIndex: number, now: string, recentLogs: DialogueLog[]): DialogueTemplate {
  const candidates = dialogueTemplates.filter((template) => template.speech_act === speechAct);
  if (candidates.length === 0) return dialogueTemplates[0];
  const usable = candidates.filter((template) => {
    const needsWord = Boolean(template.word_slot) || template.text.includes("{word}");
    if (!needsWord) return true;
    return Boolean(selectWordForTemplate(words, template, now, recentLogs));
  });
  const pool = usable.length > 0 ? usable : candidates;
  return pool[turnIndex % pool.length];
}
