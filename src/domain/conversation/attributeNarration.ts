import { displayConcept } from "../grammar/japaneseRealizer";
import { isPersonCategory, type Concept } from "../model/concept";

export function attributeMemoryBeat(concept: Concept) {
  const word = `「${displayConcept(concept)}」`;
  const parts = attributeSentences(concept, word).filter(Boolean).slice(0, 2);
  return parts.join("");
}

function attributeSentences(concept: Concept, word: string) {
  const attributes = concept.attributes;

  if (isPersonCategory(concept.userCategory)) {
    const personKinds: Record<string, string> = {
      known_person: "身近な人",
      public_person: "広く知られた人",
      fictional_person: "物語の中の人",
      role_or_title: "役目や肩書きを表す人"
    };
    const relativeStatuses: Record<string, string> = {
      very_above: "あなたよりずっと目上",
      above: "あなたより目上",
      peer: "あなたと同じくらい",
      below: "あなたより年下か後輩"
    };
    const familiarities: Record<string, string> = {
      close: "とても身近",
      known: "知っている相手",
      distant: "遠い存在",
      fictional: "物語の中にいる存在"
    };
    return compact([
      personKinds[String(attributes.personKind)]
        ? `${word}は、${personKinds[String(attributes.personKind)]}として覚えていますっ。`
        : "",
      relativeStatuses[String(attributes.relativeStatus)]
        ? rememberedDetail(concept, `${relativeStatuses[String(attributes.relativeStatus)]}の関係`)
        : familiarities[String(attributes.familiarity)]
          ? rememberedDetail(concept, `${familiarities[String(attributes.familiarity)]}な相手`)
          : ""
    ]);
  }

  if (concept.userCategory === "food_drink") {
    const consumeModes: Record<string, string> = {
      eat: "食べる",
      drink: "飲む",
      both: "食べたり飲んだりする"
    };
    const mealTimes: Record<string, string> = {
      morning: "朝",
      day: "昼",
      evening: "夜",
      snack: "おやつの時間",
      anytime: "時間を決めず"
    };
    return compact([
      consumeModes[String(attributes.consumeMode)]
        ? `${word}は、${consumeModes[String(attributes.consumeMode)]}ものとして覚えていますっ。`
        : "",
      mealTimes[String(attributes.mealTime)]
        ? rememberedDetail(concept, `${mealTimes[String(attributes.mealTime)]}に楽しむことが多い`)
        : ""
    ]);
  }

  if (concept.userCategory === "place") {
    const environments: Record<string, string> = {
      inside: "屋内",
      outside: "屋外",
      both: "屋内と屋外の両方"
    };
    const visits: Record<string, string> = {
      often: "よく行く",
      sometimes: "ときどき行く",
      want_to_go: "行ってみたい",
      rarely: "あまり行かない"
    };
    return compact([
      environments[String(attributes.environment)]
        ? `${word}は、${environments[String(attributes.environment)]}の場所として覚えていますっ。`
        : "",
      visits[String(attributes.visitMode)]
        ? rememberedDetail(concept, `${visits[String(attributes.visitMode)]}場所`)
        : ""
    ]);
  }

  if (["action", "required_action", "forbidden_action", "sport", "skill"].includes(concept.userCategory)) {
    const contexts: Record<string, string> = { home: "家や屋内", outside: "外", either: "場所を選ばず" };
    const social: Record<string, string> = {
      alone: "ひとりで",
      together: "誰かと一緒に",
      either: "ひとりでも誰かとでも"
    };
    return compact([
      contexts[String(attributes.actionContext)]
        ? `${word}は、${contexts[String(attributes.actionContext)]}ですることとして覚えていますっ。`
        : "",
      social[String(attributes.socialMode)]
        ? rememberedDetail(concept, `${social[String(attributes.socialMode)]}すること`)
        : ""
    ]);
  }

  if (concept.userCategory === "usable_object") {
    const useModes: Record<string, string> = {
      use: "手で使う",
      electric: "電気で使う",
      contain: "中に物を入れる",
      display: "置いたり飾ったりする",
      other: "決まった形に限らず使う"
    };
    const affordances: Record<string, string> = {
      work: "作業する",
      play: "遊んだり楽しんだりする",
      record: "書いたり記録したりする",
      carry: "運んだりしまったりする",
      care: "手入れする",
      eat_drink: "食べたり飲んだりする",
      cook: "料理する",
      rest: "休んだり温まったりする",
      other: "ほかの目的に使う"
    };
    const importance: Record<string, string> = {
      essential: "見つからないと、とても困る",
      troublesome: "見つからないと、少し困る",
      replaceable: "見つからなくても代わりを使える"
    };
    return compact([
      useModes[String(attributes.usageMode)]
        ? `${word}は、${useModes[String(attributes.usageMode)]}物として覚えていますっ。`
        : "",
      affordances[String(attributes.affordance)]
        ? rememberedDetail(concept, `${affordances[String(attributes.affordance)]}ための物`)
        : importance[String(attributes.importanceWhenMissing)]
          ? `${importance[String(attributes.importanceWhenMissing)]}物なんですねっ。`
          : ""
    ]);
  }

  if (concept.userCategory === "wearable") {
    const areas: Record<string, string> = {
      head: "頭",
      body: "体",
      hands: "手",
      feet: "足",
      accessory: "飾り"
    };
    const contexts: Record<string, string> = {
      daily: "いつもの日",
      outside: "外へ行く時",
      formal: "きちんとした場",
      special: "特別な日"
    };
    return compact([
      areas[String(attributes.wearArea)]
        ? `${word}は、${areas[String(attributes.wearArea)]}に身につける物として覚えていますっ。`
        : "",
      contexts[String(attributes.useContext)]
        ? rememberedDetail(concept, `${contexts[String(attributes.useContext)]}に使うことが多い物`)
        : ""
    ]);
  }

  if (concept.userCategory === "vehicle") {
    const powerModes: Record<string, string> = {
      human: "人の力で動く",
      public: "みんなで乗る",
      motor: "機械で動く",
      water_or_air: "水や空を進む",
      other: "いろいろな方法で動く"
    };
    const trips: Record<string, string> = {
      daily: "いつもの移動",
      outing: "お出かけ",
      long_trip: "遠くへの旅",
      play: "遊ぶ時",
      other: "ほかの場面"
    };
    return compact([
      powerModes[String(attributes.powerMode)]
        ? `${word}は、${powerModes[String(attributes.powerMode)]}乗り物として覚えていますっ。`
        : "",
      trips[String(attributes.tripContext)]
        ? rememberedDetail(concept, `${trips[String(attributes.tripContext)]}に乗ることが多い`)
        : ""
    ]);
  }

  if (concept.userCategory === "living_thing") {
    const relations: Record<string, string> = {
      home: "家で一緒に暮らす存在",
      wild: "自然の中にいる存在",
      plant: "植物",
      imaginary: "物語の中にいる存在"
    };
    const habitats: Record<string, string> = {
      indoors: "屋内",
      land: "地面や野原",
      water: "水の中や水辺",
      sky: "空や高い所"
    };
    return compact([
      relations[String(attributes.livingRelation)]
        ? `${word}は、${relations[String(attributes.livingRelation)]}として覚えていますっ。`
        : "",
      habitats[String(attributes.habitat)]
        ? rememberedDetail(concept, `${habitats[String(attributes.habitat)]}にいることが多い`)
        : ""
    ]);
  }

  const experienceModes: Record<string, string> = {
    listen: "聞く",
    perform: "演奏する",
    watch: "見る",
    create: "作る",
    read: "読む",
    write: "書く",
    reference: "調べる",
    other: "ほかの方法で楽しむ"
  };
  if (experienceModes[String(attributes.experienceMode)]) {
    return [`${word}は、${experienceModes[String(attributes.experienceMode)]}ものとして覚えていますっ。`];
  }

  const tones: Record<string, string> = {
    positive: "明るい気持ち",
    negative: "つらい気持ち",
    mixed: "いろいろな気持ちが混ざる時",
    neutral: "落ち着いた時"
  };
  return tones[String(attributes.feelingTone)]
    ? [`${word}は、${tones[String(attributes.feelingTone)]}に近い言葉として覚えていますっ。`]
    : [];
}

function compact(values: string[]) {
  return values.filter(Boolean);
}

function rememberedDetail(concept: Concept, detail: string) {
  return concept.source === "user" ? `${detail}と教わりましたっ。` : `${detail}と覚えていますっ。`;
}
