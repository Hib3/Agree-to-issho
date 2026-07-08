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
    emphatic: string[];
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
  bridgeStyle: {
    maxStyledLinesPerTurn: number;
    calmActs: string[];
    emphaticActs: string[];
    avoidConsecutiveLaugh: true;
  };
  constraints: {
    maxLines: number;
    maxLineLength: number;
    maxLearnedWordsPerTurn: 1;
  };
};

export const aguriStyleRules: AguriStyleRules = {
  endings: {
    warm: ["なァっ。", "よォっ。", "だよなァっ。"],
    soft: ["かもしれませんねェっ。", "少しわかる気がするよォっ。"],
    polite: ["覚えておきまァっすっ。"],
    emphatic: ["なァっ！", "よォっ！", "ですねェっ！"]
  },
  openers: {
    softener: ["まァっ", "なんかっ", "あのっそのっ"],
    empathy: ["そうなんだよなァっ", "めっちゃわかるよォっ"],
    praise: ["めっちゃ"],
    surprise: ["えェっ"]
  },
  laugh: {
    token: "ぎゃ",
    allowedCounts: [4, 6, 8],
    maxEveryTurns: 5
  },
  bridgeStyle: {
    maxStyledLinesPerTurn: 3,
    calmActs: ["greeting", "ask_new_word", "ask_category", "ask_emotion", "ask_situation", "confirm_meaning", "recall_word", "use_word_in_daily_talk"],
    emphaticActs: ["praise_user", "misunderstanding_joke", "embarrassed_reaction", "happy_reaction"],
    avoidConsecutiveLaugh: true
  },
  constraints: {
    maxLines: 4,
    maxLineLength: 38,
    maxLearnedWordsPerTurn: 1
  }
};
