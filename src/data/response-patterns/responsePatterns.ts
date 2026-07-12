import type { ResponsePattern } from "../schema/dialogue";

const focuses = [
  "人", "場所", "持ち物", "食べ物", "行動", "気持ち", "時間", "理由", "その後", "最初", "不思議な所", "安全な所", "好きな所", "心配な所", "思い出", "約束", "使い方", "呼び方", "つながり", "別の可能性"
];

export const responsePatterns: ResponsePattern[] = Array.from({ length: 160 }, (_, index) => {
  const focus = focuses[index % focuses.length] ?? "そこ";
  const mode = index % 4;
  if (mode === 0) {
    return {
      id: `response_${index}`,
      kind: "affirm_deny",
      choices: [
        { id: `affirm_${index}`, label: "その理解で合ってる", effect: "affirm" },
        { id: `deny_${index}`, label: "そこは少し違う", effect: "deny" }
      ]
    };
  }
  if (mode === 1) {
    return {
      id: `response_${index}`,
      kind: "focus",
      choices: [
        { id: `focus_${index}`, label: `${focus}が気になる`, effect: "curious" },
        { id: `continue_${index}`, label: "続きを聞きたい", effect: "affirm" },
        { id: `later_${index}`, label: "あとで考える", effect: "later" }
      ]
    };
  }
  if (mode === 2) {
    return {
      id: `response_${index}`,
      kind: "correction",
      choices: [
        { id: `keep_${index}`, label: "そのまま覚えていい", effect: "affirm" },
        { id: `fix_${index}`, label: `${focus}の関係を直す`, effect: "deny" }
      ]
    };
  }
  return {
    id: `response_${index}`,
    kind: "continue",
    choices: [
      { id: `ask_${index}`, label: `${focus}をもう少し聞く`, effect: "curious" },
      { id: `close_${index}`, label: "今日はここまで", effect: "later" }
    ]
  };
});
