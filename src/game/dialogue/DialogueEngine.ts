import type { DiaryEntry, DialogueContext, DialogueTurn, WordFrame } from "../../types/domain";

export interface DialogueEngine {
  next(context: DialogueContext): DialogueTurn;
  teachWord(input: string): Promise<WordFrame>;
  answerQuestion(questionId: string, answer: string): Promise<WordFrame>;
  correctWord(wordId: string, patch: Partial<WordFrame>): Promise<WordFrame>;
  generateDiaryEntry(context: DialogueContext): Promise<DiaryEntry>;
}
