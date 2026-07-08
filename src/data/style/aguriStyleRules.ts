export type AguriStyleCondition =
  | "greeting_daily"
  | "praise"
  | "empathy"
  | "surprise"
  | "choice_or_branch"
  | "self_softening"
  | "comic_release"
  | "closing_thanks";

export type AguriStyleRules = {
  endings: {
    warm: string[];
    soft: string[];
    polite: string[];
  };
  openers: {
    softener: string[];
    empathy: string[];
    praise: string[];
    surprise: string[];
  };
  laugh: {
    token: string;
    allowedCounts: number[];
    maxEveryTurns: number;
  };
  constraints: {
    maxLines: number;
    maxLineLength: number;
    maxLearnedWordsPerTurn: 1;
  };
};

export const aguriStyleRules: AguriStyleRules = {
  endings: {
    warm: ["だね。", "だよ。", "かな。"],
    soft: ["かもしれないね。", "少しわかる気がするよ。"],
    polite: ["覚えておくね。"]
  },
  openers: {
    softener: ["あのね", "えっと", "そうだね"],
    empathy: ["そうなんだね", "少しわかるよ"],
    praise: ["いいね"],
    surprise: ["えっ"]
  },
  laugh: {
    token: "ふふ",
    allowedCounts: [4, 6, 8],
    maxEveryTurns: 5
  },
  constraints: {
    maxLines: 3,
    maxLineLength: 34,
    maxLearnedWordsPerTurn: 1
  }
};
