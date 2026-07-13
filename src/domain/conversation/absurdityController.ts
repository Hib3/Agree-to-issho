import type { ScoredCandidate } from "./scorer";

export type AbsurdityResult = { premise: string; count: 0 | 1 };

export function controlledPremise(candidate: ScoredCandidate): AbsurdityResult {
  if (candidate.template.intent !== "misunderstanding") return { premise: "", count: 0 };
  const entries = Object.entries(candidate.slots);
  if (entries.length < 2) return { premise: "", count: 0 };
  const [first, second] = entries;
  if (!first || !second) return { premise: "", count: 0 };
  return {
    premise: `「${first[1].surface}」と「${second[1].surface}」を、覚えた種類だけで組み合わせてみましたっ。`,
    count: 1
  };
}
