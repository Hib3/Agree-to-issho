import type { ConceptCategory } from "../model/concept";

export type AttributeQuestion = {
  id: string;
  prompt: string;
  key: string;
  options: Array<{ value: string; label: string }>;
};

const preference: AttributeQuestion = {
  id: "preference",
  prompt: "その言葉、どのくらい好き？",
  key: "preference",
  options: [
    { value: "2", label: "大好き" },
    { value: "1", label: "好き" },
    { value: "0", label: "ふつう" },
    { value: "-1", label: "少し苦手" },
    { value: "-2", label: "苦手" }
  ]
};

export function questionsForCategory(category: ConceptCategory): AttributeQuestion[] {
  if (["famous_person", "person_name", "occupation", "person_descriptor"].includes(category)) {
    return [
      {
        id: "honorific",
        prompt: "その人を、どう呼べばいい？",
        key: "honorific",
        options: ["そのまま", "さん", "ちゃん", "くん", "さま", "先生"].map((label, index) => ({
          label,
          value: ["none", "san", "chan", "kun", "sama", "sensei"][index] ?? "none"
        }))
      },
      {
        id: "relativeStatus",
        prompt: "あなたとは、どんな距離の人？",
        key: "relativeStatus",
        options: [
          { value: "above", label: "目上" },
          { value: "peer", label: "同じくらい" },
          { value: "below", label: "年下・後輩" },
          { value: "unknown", label: "まだわからない" }
        ]
      },
      preference
    ];
  }
  if (["action", "required_action", "forbidden_action", "sport", "skill"].includes(category)) {
    return [
      {
        id: "suruAction",
        prompt: "「する」をつけて言う？",
        key: "suruAction",
        options: [
          { value: "true", label: "つける" },
          { value: "false", label: "つけない" }
        ]
      },
      preference
    ];
  }
  if (category === "place") {
    return [
      {
        id: "environment",
        prompt: "そこは、屋内と屋外どっち？",
        key: "environment",
        options: [
          { value: "inside", label: "屋内" },
          { value: "outside", label: "屋外" },
          { value: "unknown", label: "わからない" }
        ]
      },
      preference
    ];
  }
  if (category === "food_drink") {
    return [
      {
        id: "consumeMode",
        prompt: "食べるもの？ 飲むもの？",
        key: "consumeMode",
        options: [
          { value: "eat", label: "食べる" },
          { value: "drink", label: "飲む" },
          { value: "both", label: "どちらも" }
        ]
      },
      preference
    ];
  }
  if (["usable_object", "vehicle", "wearable"].includes(category)) {
    return [
      {
        id: "usageMode",
        prompt: "どうやって使うもの？",
        key: "usageMode",
        options: [
          { value: "use", label: "手で使う" },
          { value: "wear", label: "身につける" },
          { value: "ride", label: "乗る" },
          { value: "contain", label: "中に入れる" }
        ]
      },
      preference
    ];
  }
  return [preference];
}
