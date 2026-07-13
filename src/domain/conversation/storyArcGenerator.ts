import {
  storyArcCadences,
  storyArcPunchlineIds,
  storyArcVariants,
  type StoryArcVariant
} from "../../data/story-arcs/storyArcCatalog";
import type { RandomSource } from "../../infrastructure/random/random";
import { pickOne } from "../../infrastructure/random/random";
import { displayConcept } from "../grammar/japaneseRealizer";
import { isPersonCategory, type Concept, type ConceptCategory } from "../model/concept";
import type { PunchlineMechanism } from "../model/conversation";

type PunchlineGroup = "person" | "food" | "place" | "action" | "living" | "thing" | "idea";
type PunchlineRenderer = (word: string) => string;

export type RenderedStoryArc = {
  id: string;
  mechanism: PunchlineMechanism;
  focusConceptId: string;
  callbackConceptIds: string[];
  turn: string;
  punchline: string;
};

export function renderStoryArc(input: { focus: Concept; random: RandomSource }): RenderedStoryArc {
  const variant = pickOne(storyArcVariants, input.random) ?? storyArcVariants[0]!;
  const word = `「${displayConcept(input.focus)}」`;
  const turn = ensureCallback(renderTurn(variant, word), word);
  const punchline = ensureCallback(
    renderPunchline(input.focus.userCategory, variant.punchlineIndex, word),
    word
  );
  return {
    id: variant.id,
    mechanism: storyArcPunchlineIds[variant.punchlineIndex]!,
    focusConceptId: input.focus.id,
    callbackConceptIds: [input.focus.id],
    turn,
    punchline
  };
}

function ensureCallback(text: string, word: string) {
  return text.includes(word) ? text : `${word}のことを考えながら、${text}`;
}

function renderTurn(variant: StoryArcVariant, word: string) {
  const cadence = storyArcCadences[variant.cadenceIndex] ?? storyArcCadences[0];
  const turns = [
    "最後の順番まで、指で一つずつ追いましたっ。",
    `${word}を思い出す目印をノートにつけましたっ。`,
    `${word}の場面を、声に出して一度だけ練習しましたっ。`,
    "忘れ物がないか、机の上を端から確かめましたっ。",
    `${word}を思い出す時刻を、カレンダーへ小さく書きましたっ。`,
    "困った時のために、別の手順も一つだけ用意しましたっ。",
    `${word}のいちばん大切な所へ、紫の付箋を貼りましたっ。`,
    "最後の一行だけは、あとで本当に見てから書くことにしましたっ。"
  ];
  return `${cadence}${turns[variant.turnIndex] ?? turns[0]}`;
}

function renderPunchline(category: ConceptCategory, index: number, word: string) {
  if (index === 10) {
    return `${word}の話へ戻ってノートの線をたどったら、出発点にも同じ印をつけていましたっ！`;
  }
  const group = punchlineGroupFor(category);
  const renderers = punchlines[group];
  const renderer = renderers[index] ?? renderers[0];
  return renderer ? renderer(word) : `${word}の続きを考えたら、ノートの余白だけ先になくなりましたっ！`;
}

function punchlineGroupFor(category: ConceptCategory): PunchlineGroup {
  if (isPersonCategory(category) || category === "robot") return "person";
  if (category === "food_drink") return "food";
  if (category === "place") return "place";
  if (["action", "required_action", "forbidden_action", "sport", "skill"].includes(category)) return "action";
  if (category === "living_thing") return "living";
  if (
    ["usable_object", "wearable", "vehicle", "music", "viewable", "readable", "body_part"].includes(category)
  ) {
    return "thing";
  }
  return "idea";
}

const punchlines: Record<PunchlineGroup, PunchlineRenderer[]> = {
  person: [
    (word) => `${word}へ話しかける練習をしていたら、先にノートへ三回も挨拶していましたっ！`,
    (word) => `${word}との話題を三つ用意したのに、最初に言えたのは名前だけでしたっ！`,
    () => "落ち着く練習のはずが、鏡の中のアグリの方が先に緊張していましたっ！",
    (word) => `${word}へ渡すメモを書いたら、宛名よりアグリの署名の方が大きくなりましたっ！`,
    () => "待ち合わせの印を一つつけるつもりが、今日の日付を丸で三重に囲んでいましたっ！",
    () => "話す順番へ番号をつけたのに、なぜかゼロ番から始めていましたっ！",
    () => "聞きたいことを手へ書いたら、手を握っただけで全部隠れましたっ！",
    () => "声をかけるタイミングを待つ想像だけで、時計の針が一周しそうでしたっ！",
    (word) => `${word}のことを丁寧にまとめた結果、結論は「まず挨拶」になりましたっ！`,
    () => "結局いちばん役立ちそうなのは、深呼吸を一回することでしたっ！"
  ],
  food: [
    () => "一口だけの予定だったのに、想像の中ではお皿だけ先に空になっていましたっ！",
    (word) => `${word}の感想を書く前に、食べる順番のメモで一ページ使っていましたっ！`,
    () => "きれいに分けるつもりが、いちばん大きい分をアグリ用に丸で囲んでいましたっ！",
    () => "冷めないうちにと思ったら、ノートだけ先に閉じていましたっ！",
    (word) => `${word}を楽しむ時間を書いたら、「今すぐ」が三か所に増えましたっ！`,
    () => "香りまで想像したら、何もない机へ「いただきます」と言っていましたっ！",
    () => "一口目の顔を練習したら、まだ食べていないのに満足そうでしたっ！",
    () => "片づけまで考えたのに、使うお皿の数だけ決めていませんでしたっ！",
    (word) => `${word}を忘れない印が、なぜか大きなスプーンの絵になりましたっ！`,
    () => "結局、いちばん先に用意できたのは食べ終わった後の感想でしたっ！"
  ],
  place: [
    (word) => `${word}への道を一本で描いたら、出発した所へきれいに戻ってきましたっ！`,
    () => "近道を考えたはずなのに、曲がり角が二つ増えていましたっ！",
    (word) => `${word}へ着いた時のメモを、出発前にもう書き終えていましたっ！`,
    () => "目印を一つ決めるつもりが、見える物を全部丸で囲んでいましたっ！",
    (word) => `持ち物を全部そろえたのに、行き先の${word}だけ声に出していませんでしたっ！`,
    () => "帰り道まで確かめたら、行きより帰りの線の方が太くなりましたっ！",
    () => "迷わない方法を書いた紙を、どこへ置いたか分からなくなりましたっ！",
    () => "景色を見る場所を決めたら、アグリ自身が窓の前をふさいでいましたっ！",
    (word) => `${word}の思い出欄だけ先に作ったので、まだ行っていないのに二行埋まりましたっ！`,
    () => "最後に地図をたたんだら、大切な印だけ内側へ隠れましたっ！"
  ],
  action: [
    (word) => `${word}の準備を完璧にしたら、始める前に休憩の時間になりましたっ！`,
    () => "手順を短くするための手順が、いちばん長くなっていましたっ！",
    (word) => `${word}を一度だけ練習したら、アグリの中ではもう本番を終えた顔になりましたっ！`,
    () => "開始の印をつける場所を迷って、紙の四隅が全部開始地点になりましたっ！",
    () => "急がない計画を立てるのに、なぜか急いで鉛筆を走らせていましたっ！",
    () => "できた所へ丸をつけたら、最初の「準備」だけ花丸になりましたっ！",
    () => "失敗しない方法を考えすぎて、まだ一回も失敗できていませんでしたっ！",
    (word) => `${word}を忘れない掛け声を作ったら、掛け声の方が長くなりましたっ！`,
    () => "終わった後のごほうびだけ、予定より先に決まりましたっ！",
    () => "結局、最初の一歩は「ノートを閉じる」ことになりましたっ！"
  ],
  living: [
    () => "静かに観察していたら、動いていたのはアグリの時計の針だけでしたっ！",
    () => "そっと近づく練習をして、足音を消すことばかり上手になりましたっ！",
    () => "観察の印を一つだけつける予定が、丸印でページがいっぱいになりましたっ！",
    (word) => `${word}を描こうとしたら、最初の輪郭だけで紙の半分を使いましたっ！`,
    () => "変化を待っていたのに、先にアグリの座り方が三回変わりましたっ！",
    () => "驚かせない距離を測ったら、ものさしの長さでは全然足りませんでしたっ！",
    () => "静かな声でメモを読んだら、小さすぎてアグリにも聞こえませんでしたっ！",
    (word) => `${word}を見失わない印を描いたら、その印ばかり見ていましたっ！`,
    () => "気づいたことを一行にするつもりが、「よく見る」が三行続きましたっ！",
    () => "結局、いちばん観察できたのは待っているアグリ自身でしたっ！"
  ],
  thing: [
    (word) => `${word}を探す場面を考えていたら、想像の中では最初から手に持っていましたっ！`,
    (word) => `${word}の置き場所を書く札が、置く場所より大きくなりましたっ！`,
    () => "代わりの物を三つ用意した途端、元の物がいちばん手前に見つかりましたっ！",
    () => "しまった場所を忘れないように書いたメモを、先にしまい込みましたっ！",
    (word) => `${word}の使い方を確かめる前に、片づけ方だけ詳しくなりましたっ！`,
    () => "持ち物の数を数えたら、数えるための鉛筆も一個に入れていましたっ！",
    () => "目立つ印を貼ったのに、その印が気になって本体を見ていませんでしたっ！",
    (word) => `${word}を忘れない絵を描いたら、絵の方を持って出かけそうになりましたっ！`,
    () => "説明を短くまとめたら、「大切にする」の一行だけ残りましたっ！",
    () => "最後に確認したら、探していた物より確認表の方が増えていましたっ！"
  ],
  idea: [
    (word) => `${word}を一行でまとめようとして、その一行を三回書き直しましたっ！`,
    () => "分かりやすい順番に並べたら、最初と最後が同じ言葉になりましたっ！",
    () => "大事な所へ線を引いたら、ほとんど全部が大事になりましたっ！",
    (word) => `${word}を忘れない合図を決めたのに、合図の意味から先に忘れそうでしたっ！`,
    () => "考えを小さく分けたら、小さな考えが机いっぱいに増えましたっ！",
    () => "答えを急がないと決めた直後に、答えの欄だけ先に囲みましたっ！",
    () => "似ている所を探したら、違う所のメモの方が長くなりましたっ！",
    (word) => `${word}の題名を大きく書きすぎて、本文を置く場所がなくなりましたっ！`,
    () => "一番よい説明を選ぶつもりが、候補全部へ丸をつけましたっ！",
    () => "結局、きれいにまとまったのはページ番号だけでしたっ！"
  ]
};
