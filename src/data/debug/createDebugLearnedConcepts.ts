import type { Concept } from "../../domain/model/concept";
import { starterConcepts } from "../starter/starterConcepts";

const indoorPlaces = new Set([
  "部屋",
  "台所",
  "玄関",
  "廊下",
  "図書館",
  "学校",
  "喫茶店",
  "食堂",
  "温室",
  "工房",
  "劇場",
  "映画館",
  "美術館",
  "病院",
  "郵便局"
]);
const mixedPlaces = new Set(["駅", "商店街", "市場", "展望台"]);
const drinks = new Set(["お茶", "麦茶", "紅茶", "牛乳", "水", "炭酸水", "果物ジュース", "ココア"]);
const foodAndDrink = new Set(["スープ", "みそ汁", "はちみつ"]);
const snacks = new Set(["せんべい", "クッキー", "ケーキ", "プリン", "ゼリー", "あめ", "チョコレート"]);
const homeLivingThings = new Set(["犬", "猫", "小鳥", "金魚", "めだか", "うさぎ"]);
const plants = new Set(["木", "花"]);
const waterLivingThings = new Set(["金魚", "めだか", "かえる", "かたつむり"]);
const skyLivingThings = new Set(["小鳥", "すずめ", "はと", "ちょう", "てんとう虫"]);
const electricObjects = new Set(["懐中電灯", "電池", "ラジオ", "カメラ", "受話器", "扇風機", "暖房"]);
const recordObjects = new Set(["手帳", "ノート", "鉛筆", "消しゴム", "定規", "封筒", "カメラ"]);
const eatingObjects = new Set(["お皿", "茶わん", "コップ", "はし", "スプーン", "フォーク", "水筒"]);
const cookingObjects = new Set(["鍋", "やかん"]);
const careObjects = new Set(["タオル", "せっけん", "くし", "歯ブラシ", "じょうろ", "ほうき", "ちりとり"]);
const restObjects = new Set(["毛布", "枕", "クッション", "暖房"]);
const positiveIdeas = new Set([
  "うれしさ",
  "楽しさ",
  "安心",
  "勇気",
  "元気",
  "やさしさ",
  "大切",
  "思い出",
  "夢",
  "仲直り",
  "期待",
  "満足",
  "好奇心"
]);
const difficultIdeas = new Set(["心配", "緊張", "照れ", "さみしさ"]);

export function createDebugLearnedConcepts(count = 100, now = Date.now()): Concept[] {
  return Array.from({ length: Math.max(0, Math.min(count, starterConcepts.length)) }, (_, index) => {
    const source = starterConcepts[(index * 37) % starterConcepts.length]!;
    return {
      ...source,
      grammar: { ...source.grammar },
      id: `debug_user_${String(index + 1).padStart(3, "0")}`,
      source: "user" as const,
      learnedAt: now - index * 60_000,
      usageCount: index % 7,
      understanding: 0.42 + (index % 6) * 0.09,
      ambiguity: 0.68 - (index % 6) * 0.08,
      preference: ([-2, -1, 0, 1, 2] as const)[index % 5] ?? 0,
      attributes: { ...source.attributes, ...debugAttributesFor(source) }
    } satisfies Concept;
  });
}

function debugAttributesFor(concept: Concept): Concept["attributes"] {
  const category = concept.userCategory;
  const surface = concept.surface;
  if (["famous_person", "person_name", "occupation", "person_descriptor"].includes(category)) {
    if (category === "occupation") {
      return {
        honorific: "san",
        personKind: "role_or_title",
        relativeStatus: "unknown",
        familiarity: "unknown"
      };
    }
    const relativeStatus =
      surface === "先輩" || surface === "おとな"
        ? "above"
        : surface === "後輩" || surface === "子ども"
          ? "below"
          : "peer";
    const familiarity = ["友だち", "家族", "先輩", "後輩", "ご近所さん"].includes(surface)
      ? "close"
      : "known";
    return { honorific: "none", personKind: "known_person", relativeStatus, familiarity };
  }
  if (["action", "required_action", "forbidden_action", "sport", "skill"].includes(category)) {
    const outside = new Set(["散歩", "買い物", "旅行", "遠足", "登山", "水泳", "走ること", "釣り"]);
    const together = new Set(["相談", "待ち合わせ", "応援", "挨拶", "お祝い", "手伝い", "電話"]);
    return {
      suruAction: true,
      actionContext: outside.has(surface) ? "outside" : "home",
      socialMode: together.has(surface) ? "together" : "either"
    };
  }
  if (category === "place") {
    const environment = indoorPlaces.has(surface) ? "inside" : mixedPlaces.has(surface) ? "both" : "outside";
    return { environment, visitMode: "sometimes", socialMode: "together" };
  }
  if (category === "food_drink") {
    const consumeMode = drinks.has(surface) ? "drink" : foodAndDrink.has(surface) ? "both" : "eat";
    return { consumeMode, mealTime: snacks.has(surface) ? "snack" : "day" };
  }
  if (category === "living_thing") {
    const livingRelation = plants.has(surface) ? "plant" : homeLivingThings.has(surface) ? "home" : "wild";
    const habitat = waterLivingThings.has(surface) ? "water" : skyLivingThings.has(surface) ? "sky" : "land";
    return { livingRelation, habitat };
  }
  if (category === "usable_object") {
    const isContainer = concept.attributes.usageMode === "contain";
    const usageMode = isContainer
      ? "contain"
      : electricObjects.has(surface)
        ? "electric"
        : surface === "棚" || surface === "机"
          ? "display"
          : "use";
    const affordance = recordObjects.has(surface)
      ? "record"
      : eatingObjects.has(surface)
        ? "eat_drink"
        : cookingObjects.has(surface)
          ? "cook"
          : careObjects.has(surface)
            ? "care"
            : restObjects.has(surface)
              ? "rest"
              : isContainer
                ? "carry"
                : "work";
    return {
      objectKind: isContainer ? "container" : electricObjects.has(surface) ? "electric" : "tool",
      usageMode,
      affordance,
      importanceWhenMissing: "troublesome"
    };
  }
  if (category === "wearable") {
    const wearArea = ["帽子"].includes(surface)
      ? "head"
      : ["靴", "長靴", "靴下"].includes(surface)
        ? "feet"
        : ["手袋"].includes(surface)
          ? "hands"
          : ["眼鏡", "腕時計", "リボン", "指輪", "首飾り", "ベルト"].includes(surface)
            ? "accessory"
            : "body";
    return { wearArea, useContext: "daily" };
  }
  if (category === "vehicle") {
    const powerMode = ["自転車", "三輪車", "一輪車", "そり", "手押し車"].includes(surface)
      ? "human"
      : ["バス", "電車", "地下鉄", "路面電車", "タクシー"].includes(surface)
        ? "public"
        : ["船", "ボート", "飛行機", "気球"].includes(surface)
          ? "water_or_air"
          : "motor";
    return { powerMode, tripContext: ["飛行機", "船"].includes(surface) ? "long_trip" : "outing" };
  }
  if (category === "music")
    return {
      experienceMode: ["演奏", "合唱", "鼻歌"].includes(surface) ? "perform" : "listen",
      socialMode: "either"
    };
  if (category === "viewable") return { experienceMode: "watch", socialMode: "either" };
  if (category === "readable") return { experienceMode: "read", socialMode: "either" };
  if (category === "word_expression") return { feelingTone: "positive", socialMode: "together" };
  if (category === "abstract") {
    const feelingTone = positiveIdeas.has(surface)
      ? "positive"
      : difficultIdeas.has(surface)
        ? "negative"
        : "neutral";
    return { feelingTone, socialMode: "either" };
  }
  return { feelingTone: "unknown", socialMode: "unknown" };
}
