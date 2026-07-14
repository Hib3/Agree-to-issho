export type NewsFactAction =
  | "announce"
  | "explain"
  | "consider"
  | "confirm"
  | "investigate"
  | "test"
  | "restrict"
  | "introduce"
  | "sell"
  | "hold"
  | "extend"
  | "achieve"
  | "publish"
  | "start"
  | "change"
  | "request"
  | "use";

export type GroundedNewsFactFrame = {
  subject?: string | undefined;
  object?: string | undefined;
  action: NewsFactAction;
  activePredicate: string;
  passivePredicate: string;
  actionNoun: string;
  confidence: number;
};

type ActionRule = {
  action: NewsFactAction;
  pattern: RegExp;
  activePredicate: string;
  passivePredicate: string;
  actionNoun: string;
};

const actionRules: ActionRule[] = [
  rule("announce", /(?:発表|公表)(?:し|さ|する|した|され|しました)/u, "発表した", "発表された", "発表"),
  rule("explain", /説明(?:し|する|した|され|しました)/u, "説明した", "説明された", "説明"),
  rule("consider", /検討(?:し|する|した|され|中|しています|に入)/u, "検討している", "検討されている", "検討"),
  rule("investigate", /(?:調査|調べ)(?:し|る|て|た|ています)/u, "調べている", "調べられている", "調査"),
  rule("confirm", /確認(?:し|する|した|され|しています)/u, "確認している", "確認されている", "確認"),
  rule("test", /(?:試験を(?:始め|実施)|試(?:す|し|して|した))/u, "試している", "試されている", "試験"),
  rule(
    "restrict",
    /制限(?:し|する|した|され|させ)/u,
    "制限しようとしている",
    "制限されようとしている",
    "制限"
  ),
  rule("introduce", /導入(?:し|する|した|され)/u, "導入した", "導入された", "導入"),
  rule("sell", /販売(?:し|する|した|され)/u, "販売した", "販売された", "販売"),
  rule("hold", /(?:開催(?:し|する|した|され)|催しを[^。]{0,12}開く)/u, "開いた", "開かれた", "開催"),
  rule("extend", /延長(?:し|する|した|され)/u, "延長した", "延長された", "延長"),
  rule("achieve", /達成(?:し|する|した|され)/u, "達成した", "達成された", "達成"),
  rule("publish", /公開(?:し|する|した|され)/u, "公開した", "公開された", "公開"),
  rule("start", /(?:開始|始め)(?:し|る|た|され)/u, "始めた", "始められた", "開始"),
  rule("request", /求め(?:る|た|て|ています)/u, "求めている", "求められている", "要請"),
  rule(
    "use",
    /(?:利用|使用|使ってみ)(?:し|する|した|され|ました)?/u,
    "実際に使った",
    "実際に使われた",
    "使用"
  ),
  rule(
    "change",
    /(?:変化|増加|減少)(?:し|する|した|して)|(?:上がる|下がる|高まる|低下する)/u,
    "変化した",
    "変化した",
    "変化"
  )
];

const actionObjectTerms: Record<NewsFactAction, string[]> = {
  announce: ["声明", "計画", "方針", "投票日程", "調査結果", "観測結果", "結果", "日程"],
  explain: ["発言の趣旨", "方針", "内容"],
  consider: ["会期の延長", "法案", "計画", "制度", "導入"],
  confirm: ["被害状況", "感染状況", "影響", "状況", "結果"],
  investigate: ["被害状況", "感染状況", "影響", "経緯", "状況"],
  test: ["案内表示", "自動再生機能", "推薦機能", "機能", "表示", "制度", "商品"],
  restrict: ["自動再生機能", "推薦機能", "利用時間", "機能", "サービス"],
  introduce: ["案内表示", "制度", "サービス", "機能", "表示"],
  sell: ["商品", "食品"],
  hold: ["催し"],
  extend: ["会期", "開館時間", "期間", "期限", "時間"],
  achieve: ["記録", "目標"],
  publish: ["観測結果", "調査結果", "結果", "情報"],
  start: ["試験", "調査", "サービス", "制度"],
  change: ["価格", "利用時間", "状況", "数値"],
  request: ["対応", "説明", "改善"],
  use: ["商品", "サービス", "機能"]
};

const invalidSubjects = /^(?:今回|現在|今後|多く|これ|それ|この|その|週末|同日|一方|記事|声明|法案)/u;

export function extractGroundedNewsFact(text: string): GroundedNewsFactFrame | undefined {
  const cleaned = text
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const actionMatch = actionRules
    .flatMap((candidate) => {
      const match = candidate.pattern.exec(cleaned);
      return match ? [{ candidate, index: match.index }] : [];
    })
    .sort((left, right) => right.index - left.index)[0];
  if (!actionMatch) return undefined;
  const action = actionMatch.candidate;

  const subject = extractSubject(cleaned);
  const object = extractObject(cleaned, action.action, actionMatch.index);
  if (!subject && !object) return undefined;
  return {
    ...(subject ? { subject } : {}),
    ...(object ? { object } : {}),
    action: action.action,
    activePredicate: action.activePredicate,
    passivePredicate: action.passivePredicate,
    actionNoun: action.actionNoun,
    confidence: subject && object ? 0.86 : 0.72
  };
}

export function realizeGroundedNewsFact(frame: GroundedNewsFactFrame, sourceLead: string): string {
  if (frame.subject && frame.object)
    return `${sourceLead}${frame.subject}が${frame.object}を${frame.activePredicate}ことを確認できます。`;
  if (frame.subject) return `${sourceLead}${frame.subject}による${frame.actionNoun}が確認できます。`;
  if (frame.action === "use") return `${sourceLead}${frame.object}を実際に試した内容だと確認できます。`;
  return `${sourceLead}${frame.object}が${frame.passivePredicate}ことを確認できます。`;
}

function extractSubject(text: string) {
  const candidate = text.match(/^([^、。！？!?]{2,36}?)(?:は|が)[、,\s]?/u)?.[1]?.trim();
  if (!candidate || invalidSubjects.test(candidate) || /(?:では|には|から|について)$/u.test(candidate))
    return undefined;
  if ((candidate.match(/[「」『』]/gu) ?? []).length > 0) return undefined;
  return Array.from(candidate).length <= 32 ? candidate : undefined;
}

function extractObject(text: string, action: NewsFactAction, actionIndex: number) {
  if (action === "explain" && /発言/u.test(text)) return "発言の趣旨";
  if (action === "consider" && /会期[^。]{0,24}延長/u.test(text)) return "会期の延長";
  if (action === "use" && /(?:バッグ|かばん|製品|商品)/u.test(text)) return "商品";
  const beforeAction = text.slice(0, actionIndex + 1);
  return actionObjectTerms[action]
    .filter((term) => beforeAction.includes(term === "発言の趣旨" ? "発言" : term))
    .sort((left, right) => {
      const leftSource = left === "発言の趣旨" ? "発言" : left;
      const rightSource = right === "発言の趣旨" ? "発言" : right;
      const leftEnd = beforeAction.lastIndexOf(leftSource) + leftSource.length;
      const rightEnd = beforeAction.lastIndexOf(rightSource) + rightSource.length;
      return rightEnd - leftEnd || rightSource.length - leftSource.length;
    })[0];
}

function rule(
  action: NewsFactAction,
  pattern: RegExp,
  activePredicate: string,
  passivePredicate: string,
  actionNoun: string
): ActionRule {
  return { action, pattern, activePredicate, passivePredicate, actionNoun };
}
