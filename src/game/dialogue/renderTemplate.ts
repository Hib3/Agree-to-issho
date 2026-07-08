import type { DialogueTemplate, WordFrame } from "../../types/domain";

export function renderTemplate(template: DialogueTemplate, word: WordFrame | null): string {
  if (!template.text.includes("{word}")) return template.text;
  if (!word) return "今はまだ、うまく言葉を選べませんでした。";
  return template.text.split("{word}").join(word.surface);
}
