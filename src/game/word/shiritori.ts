import type { WordFrame } from "../../types/domain";

export type ShiritoriCandidate = {
  from: WordFrame;
  next: WordFrame[];
};

export function getShiritoriCandidates(words: WordFrame[], limit = 6): ShiritoriCandidate[] {
  const usable = words
    .filter((word) => !word.is_blocked && !word.is_sensitive && !word.forgotten_at)
    .filter((word) => normalizeReading(word.pronunciation_key || word.reading || word.surface).length >= 2);

  return usable
    .map((from) => {
      const tail = getLastKana(from);
      const next = usable
        .filter((word) => word.id !== from.id && getFirstKana(word) === tail)
        .slice(0, 4);
      return { from, next };
    })
    .filter((item) => item.next.length > 0)
    .slice(0, limit);
}

function getFirstKana(word: WordFrame) {
  return normalizeReading(word.pronunciation_key || word.reading || word.surface).charAt(0);
}

function getLastKana(word: WordFrame) {
  const reading = normalizeReading(word.pronunciation_key || word.reading || word.surface);
  return reading.charAt(reading.length - 1);
}

function normalizeReading(value: string) {
  return value.trim().replace(/[ァ-ン]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}
