import { dialogueTemplates } from "../../data/templates/dialogueTemplates";
import { generateDiaryEntryFromContext } from "../diary/generateDiaryEntry";
import { createWordFrame } from "../word/createWordFrame";
import type { DialogueContext, DialogueTemplate, DialogueTurn, DiaryEntry, SpeechAct, WordFrame } from "../../types/domain";
import type { DialogueEngine } from "./DialogueEngine";
import { applyAguriStyle } from "./applyAguriStyle";
import { renderTemplate } from "./renderTemplate";
import { selectSpeechAct } from "./selectSpeechAct";
import { selectWordForTemplate } from "./wordScoring";

export class TemplateDialogueEngine implements DialogueEngine {
  next(context: DialogueContext): DialogueTurn {
    const turnIndex = context.words.reduce((sum, item) => sum + item.use_count, 0);
    const speechAct = selectSpeechAct(context);
    const template = chooseTemplate(speechAct, context.words, turnIndex);
    const word = template.word_slot || template.text.includes("{word}") ? selectWordForTemplate(context.words, template, context.now) : null;
    const renderedText = renderTemplate(template, word, context.words);
    return {
      speech_act: speechAct,
      text: applyAguriStyle({ template, renderedText, speechAct, word, turnIndex }),
      expression: template.expression,
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

function chooseTemplate(speechAct: SpeechAct, words: WordFrame[], turnIndex: number): DialogueTemplate {
  const candidates = dialogueTemplates.filter((template) => template.speech_act === speechAct);
  if (candidates.length === 0) return dialogueTemplates[0];
  const usable = candidates.filter((template) => {
    if (!template.word_slot?.category) return true;
    return words.some((word) => !word.is_blocked && !word.is_sensitive && word.category === template.word_slot?.category);
  });
  const pool = usable.length > 0 ? usable : candidates;
  return pool[turnIndex % pool.length];
}
