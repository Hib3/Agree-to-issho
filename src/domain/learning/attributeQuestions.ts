import type { ConceptCategory } from "../model/concept";

export type AttributeQuestion = {
  id: string;
  prompt: string;
  key: string;
  options: Array<{ value: string; label: string }>;
};

const preference: AttributeQuestion = question("preference", "その言葉、どのくらい好き？", "preference", [
  ["2", "大好き"],
  ["1", "好き"],
  ["0", "ふつう"],
  ["-1", "少し苦手"],
  ["-2", "苦手"]
]);

const honorific = question("honorific", "その人を、どう呼べばいい？", "honorific", [
  ["none", "そのまま"],
  ["san", "さん"],
  ["chan", "ちゃん"],
  ["kun", "くん"],
  ["sama", "さま"],
  ["sensei", "先生"]
]);

const socialMode = question("socialMode", "ひとりでする？ 誰かとする？", "socialMode", [
  ["alone", "ひとり"],
  ["together", "誰かと一緒"],
  ["either", "どちらでも"],
  ["unknown", "まだ分からない"]
]);

export function questionsForCategory(category: ConceptCategory): AttributeQuestion[] {
  if (["famous_person", "person_name", "occupation", "person_descriptor"].includes(category)) {
    return [
      honorific,
      question("personKind", "どんな人として覚える？", "personKind", [
        ["known_person", "身近な人"],
        ["public_person", "広く知られた人"],
        ["fictional_person", "物語の人"],
        ["role_or_title", "役目や肩書き"],
        ["unknown", "まだ分からない"]
      ]),
      question("relativeStatus", "あなたとは、どんな関係の人？", "relativeStatus", [
        ["above", "目上・年上"],
        ["peer", "同じくらい"],
        ["below", "年下・後輩"],
        ["unknown", "まだ分からない"]
      ]),
      question("familiarity", "どのくらい身近な人？", "familiarity", [
        ["close", "とても身近"],
        ["known", "知っている"],
        ["distant", "遠い存在"],
        ["fictional", "物語の中"],
        ["unknown", "まだ分からない"]
      ]),
      preference
    ];
  }

  if (category === "robot") {
    return [
      question("robotRole", "どんな役目のロボット？", "robotRole", [
        ["helper", "手伝う"],
        ["companion", "一緒に過ごす"],
        ["machine", "作業する"],
        ["fictional", "物語に出る"],
        ["unknown", "まだ分からない"]
      ]),
      socialMode,
      preference
    ];
  }

  if (["action", "required_action", "forbidden_action", "sport", "skill"].includes(category)) {
    return [
      question("suruAction", "言葉の後ろに「する」をつけて言う？", "suruAction", [
        ["true", "つける"],
        ["false", "つけない"]
      ]),
      question("actionContext", "どこですることが多い？", "actionContext", [
        ["home", "家や屋内"],
        ["outside", "外"],
        ["either", "どちらでも"],
        ["unknown", "まだ分からない"]
      ]),
      socialMode,
      preference
    ];
  }

  if (category === "place") {
    return [
      question("environment", "そこは、屋内と屋外のどっち？", "environment", [
        ["inside", "屋内"],
        ["outside", "屋外"],
        ["both", "両方ある"],
        ["unknown", "まだ分からない"]
      ]),
      question("visitMode", "その場所には、どのくらい行く？", "visitMode", [
        ["often", "よく行く"],
        ["sometimes", "ときどき行く"],
        ["want_to_go", "行ってみたい"],
        ["rarely", "あまり行かない"],
        ["unknown", "まだ分からない"]
      ]),
      socialMode,
      preference
    ];
  }

  if (category === "food_drink") {
    return [
      question("consumeMode", "食べるもの？ 飲むもの？", "consumeMode", [
        ["eat", "食べる"],
        ["drink", "飲む"],
        ["both", "どちらも"]
      ]),
      question("mealTime", "いつ楽しむことが多い？", "mealTime", [
        ["morning", "朝"],
        ["day", "昼"],
        ["evening", "夜"],
        ["snack", "おやつ"],
        ["anytime", "いつでも"]
      ]),
      preference
    ];
  }

  if (category === "living_thing") {
    return [
      question("livingRelation", "どんな存在として覚える？", "livingRelation", [
        ["home", "家で一緒に暮らす"],
        ["wild", "自然の中にいる"],
        ["plant", "植物"],
        ["imaginary", "物語の中にいる"],
        ["unknown", "まだ分からない"]
      ]),
      question("habitat", "どこにいることが多い？", "habitat", [
        ["indoors", "屋内"],
        ["land", "地面や野原"],
        ["water", "水の中や水辺"],
        ["sky", "空や高い所"],
        ["unknown", "まだ分からない"]
      ]),
      preference
    ];
  }

  if (category === "usable_object") {
    return [
      question("objectKind", "どんな種類の物？", "objectKind", [
        ["tool", "道具"],
        ["electric", "電気で動く物"],
        ["container", "中に入れる物"],
        ["decoration", "飾る物"],
        ["other", "ほかの物"]
      ]),
      question("usageMode", "どうやって使う？", "usageMode", [
        ["use", "手で使う"],
        ["electric", "電気で使う"],
        ["contain", "中に入れる"],
        ["display", "置いたり飾ったりする"],
        ["other", "ほかの使い方"]
      ]),
      question("affordance", "何をするための物？", "affordance", [
        ["work", "作業する"],
        ["play", "遊ぶ・楽しむ"],
        ["record", "書く・記録する"],
        ["carry", "運ぶ・しまう"],
        ["care", "手入れする"],
        ["eat_drink", "食べたり飲んだりする"],
        ["cook", "料理する"],
        ["rest", "休んだり温まったりする"],
        ["other", "ほかの目的"]
      ]),
      question("importanceWhenMissing", "見つからなかったら、どのくらい困る？", "importanceWhenMissing", [
        ["essential", "とても困る"],
        ["troublesome", "少し困る"],
        ["replaceable", "代わりがある"],
        ["unknown", "まだ分からない"]
      ]),
      preference
    ];
  }

  if (category === "wearable") {
    return [
      question("wearArea", "どこに身につける？", "wearArea", [
        ["head", "頭"],
        ["body", "体"],
        ["hands", "手"],
        ["feet", "足"],
        ["accessory", "飾りとして"]
      ]),
      question("useContext", "どんな時に身につける？", "useContext", [
        ["daily", "いつもの日"],
        ["outside", "外へ行く時"],
        ["formal", "きちんとした場"],
        ["special", "特別な日"],
        ["unknown", "まだ分からない"]
      ]),
      preference
    ];
  }

  if (category === "vehicle") {
    return [
      question("powerMode", "どんな動き方をする乗り物？", "powerMode", [
        ["human", "人の力で動く"],
        ["public", "みんなで乗る"],
        ["motor", "機械で動く"],
        ["water_or_air", "水や空を進む"],
        ["other", "ほかの動き方"]
      ]),
      question("tripContext", "どんな時に乗る？", "tripContext", [
        ["daily", "いつもの移動"],
        ["outing", "お出かけ"],
        ["long_trip", "遠くへの旅"],
        ["play", "遊ぶ時"],
        ["other", "ほかの時"]
      ]),
      preference
    ];
  }

  if (["music", "viewable", "readable"].includes(category)) {
    const options = category === "music"
      ? [["listen", "聞く"], ["perform", "演奏する"], ["create", "作る"], ["other", "ほか"]]
      : category === "viewable"
        ? [["watch", "見る"], ["create", "作る"], ["other", "ほか"]]
        : [["read", "読む"], ["write", "書く"], ["reference", "調べる"], ["other", "ほか"]];
    return [
      question("experienceMode", "どうやって楽しんだり使ったりする？", "experienceMode", options),
      socialMode,
      preference
    ];
  }

  if (category === "word_expression") {
    return [
      question("useContext", "どんな時に言うことが多い？", "useContext", [
        ["daily", "いつもの会話"],
        ["outside", "外で会った時"],
        ["formal", "きちんと伝える時"],
        ["special", "特別な時"],
        ["unknown", "まだ分からない"]
      ]),
      question("feelingTone", "どんな気持ちで使う？", "feelingTone", [
        ["positive", "明るい気持ち"],
        ["negative", "つらい気持ち"],
        ["mixed", "いろいろ混ざる"],
        ["neutral", "落ち着いて使う"],
        ["unknown", "まだ分からない"]
      ]),
      preference
    ];
  }

  if (["abstract", "body_part", "illness", "other"].includes(category)) {
    return [
      question("feelingTone", "その言葉は、どんな気分に近い？", "feelingTone", [
        ["positive", "明るい"],
        ["negative", "つらい"],
        ["mixed", "どちらも混ざる"],
        ["neutral", "気分とは別"],
        ["unknown", "まだ分からない"]
      ]),
      question("socialMode", "ひとりの時と、誰かといる時のどちらに近い？", "socialMode", [
        ["alone", "ひとりの時"],
        ["together", "誰かといる時"],
        ["either", "どちらでも"],
        ["unknown", "まだ分からない"]
      ]),
      preference
    ];
  }

  return [preference];
}

export function attributeQuestionsForCategory(category: ConceptCategory) {
  return questionsForCategory(category).filter((item) => item.id !== "preference");
}

export function answerLabel(questionItem: AttributeQuestion, value: string | number | boolean | null | undefined) {
  return questionItem.options.find((option) => option.value === String(value))?.label ?? String(value ?? "");
}

function question(id: string, prompt: string, key: string, options: string[][]): AttributeQuestion {
  return {
    id,
    prompt,
    key,
    options: options.map(([value, label]) => ({ value: value ?? "", label: label ?? "" }))
  };
}
