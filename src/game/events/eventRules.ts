import type { EventFlag, WordFrame } from "../../types/domain";
import { nowIso } from "../../utils/id";

export function deriveEventFlags(words: WordFrame[]): EventFlag[] {
  return [
    {
      id: "word_count_1",
      key: "word_count_1",
      value: words.length >= 1,
      updated_at: nowIso()
    },
    {
      id: "word_count_5",
      key: "word_count_5",
      value: words.length >= 5,
      updated_at: nowIso()
    }
  ];
}
