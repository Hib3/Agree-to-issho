import type { ConceptGrammar, LexicalProfile } from "../model/concept";

type ActionInflection = {
  suruAction: boolean;
  verbDictionaryForm: string;
  teForm: string;
  pastForm: string;
  negativeForm: string;
  potentialForm: string;
  conjugation: NonNullable<LexicalProfile["conjugation"]>;
};

const suruActions = new Set([
  "散歩",
  "昼寝",
  "料理",
  "掃除",
  "洗濯",
  "読書",
  "勉強",
  "仕事",
  "買い物",
  "旅行",
  "運動",
  "体操",
  "練習",
  "電話",
  "相談",
  "応援",
  "挨拶",
  "お祝い",
  "休憩",
  "深呼吸",
  "背伸び",
  "観察",
  "探し物",
  "工作",
  "裁縫",
  "登山",
  "水泳"
]);

const specialActions: Record<string, ActionInflection> = {
  遠足: godan("遠足に行く", "遠足に行って", "遠足に行った", "遠足に行かない", "遠足に行ける"),
  歌: godan("歌う", "歌って", "歌った", "歌わない", "歌える"),
  踊り: godan("踊る", "踊って", "踊った", "踊らない", "踊れる"),
  お絵かき: godan("絵を描く", "絵を描いて", "絵を描いた", "絵を描かない", "絵を描ける"),
  写真: godan("写真を撮る", "写真を撮って", "写真を撮った", "写真を撮らない", "写真を撮れる"),
  手紙: godan("手紙を書く", "手紙を書いて", "手紙を書いた", "手紙を書かない", "手紙を書ける"),
  約束すること: suru("約束"),
  待ち合わせ: ichidan("待ち合わせる", "待ち合わせて", "待ち合わせた", "待ち合わせない", "待ち合わせられる"),
  手伝い: godan("手伝う", "手伝って", "手伝った", "手伝わない", "手伝える"),
  見つけること: ichidan("見つける", "見つけて", "見つけた", "見つけない", "見つけられる"),
  片づけ: ichidan("片づける", "片づけて", "片づけた", "片づけない", "片づけられる"),
  水やり: godan("水をやる", "水をやって", "水をやった", "水をやらない", "水をやれる"),
  日記: godan("日記を書く", "日記を書いて", "日記を書いた", "日記を書かない", "日記を書ける"),
  釣り: {
    suruAction: true,
    verbDictionaryForm: "釣りをする",
    teForm: "釣りをして",
    pastForm: "釣りをした",
    negativeForm: "釣りをしない",
    potentialForm: "釣りができる",
    conjugation: "suru"
  },
  走ること: godan("走る", "走って", "走った", "走らない", "走れる"),
  跳ぶこと: godan("跳ぶ", "跳んで", "跳んだ", "跳ばない", "跳べる"),
  笑うこと: godan("笑う", "笑って", "笑った", "笑わない", "笑える"),
  考えること: ichidan("考える", "考えて", "考えた", "考えない", "考えられる"),
  覚えること: ichidan("覚える", "覚えて", "覚えた", "覚えない", "覚えられる"),
  比べること: ichidan("比べる", "比べて", "比べた", "比べない", "比べられる"),
  選ぶこと: godan("選ぶ", "選んで", "選んだ", "選ばない", "選べる"),
  届けること: ichidan("届ける", "届けて", "届けた", "届けない", "届けられる"),
  迎えること: ichidan("迎える", "迎えて", "迎えた", "迎えない", "迎えられる")
};

export function knownActionInflection(surface: string): ActionInflection | undefined {
  return specialActions[surface] ?? (suruActions.has(surface) ? suru(surface) : undefined);
}

export function applyKnownActionGrammar(grammar: ConceptGrammar, surface: string): ConceptGrammar {
  const inflection = knownActionInflection(surface);
  if (!inflection) return grammar;
  return {
    ...grammar,
    suruAction: inflection.suruAction,
    verbDictionaryForm: inflection.verbDictionaryForm,
    teForm: inflection.teForm,
    pastForm: inflection.pastForm,
    negativeForm: inflection.negativeForm,
    potentialForm: inflection.potentialForm
  };
}

export function knownActionLexicalProfile(surface: string): LexicalProfile | undefined {
  const inflection = knownActionInflection(surface);
  if (!inflection) return undefined;
  return {
    partOfSpeech: inflection.suruAction ? "verbal_noun" : "verb",
    conjugation: inflection.conjugation,
    quotePolicy: "allow_inflection",
    honorificPolicy: "none",
    confidence: 1
  };
}

function suru(surface: string): ActionInflection {
  return {
    suruAction: true,
    verbDictionaryForm: `${surface}する`,
    teForm: `${surface}して`,
    pastForm: `${surface}した`,
    negativeForm: `${surface}しない`,
    potentialForm: `${surface}できる`,
    conjugation: "suru"
  };
}

function godan(
  verbDictionaryForm: string,
  teForm: string,
  pastForm: string,
  negativeForm: string,
  potentialForm: string
): ActionInflection {
  return {
    suruAction: false,
    verbDictionaryForm,
    teForm,
    pastForm,
    negativeForm,
    potentialForm,
    conjugation: "godan"
  };
}

function ichidan(
  verbDictionaryForm: string,
  teForm: string,
  pastForm: string,
  negativeForm: string,
  potentialForm: string
): ActionInflection {
  return {
    suruAction: false,
    verbDictionaryForm,
    teForm,
    pastForm,
    negativeForm,
    potentialForm,
    conjugation: "ichidan"
  };
}
