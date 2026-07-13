import type { ConceptCategory } from "../model/concept";
import type { LearningContextId } from "./learningMachine";

export type CategoryGroup = { id: string; label: string; categories: ConceptCategory[] };

export const categoryGroups: CategoryGroup[] = [
  {
    id: "people",
    label: "人",
    categories: ["famous_person", "person_name", "occupation", "person_descriptor", "robot"]
  },
  {
    id: "actions",
    label: "行動",
    categories: ["action", "required_action", "forbidden_action", "sport", "skill"]
  },
  { id: "places", label: "場所", categories: ["place"] },
  { id: "food-life", label: "食べ物・生き物", categories: ["food_drink", "living_thing"] },
  { id: "objects", label: "物", categories: ["usable_object", "wearable", "vehicle"] },
  { id: "works", label: "作品・言葉", categories: ["music", "viewable", "readable", "word_expression"] },
  { id: "body", label: "体", categories: ["body_part", "illness"] },
  { id: "ideas", label: "考え・その他", categories: ["abstract", "other"] }
];

const contextSuggestions: Record<LearningContextId, ConceptCategory[]> = {
  room_object: ["usable_object", "wearable", "readable", "other"],
  companion: ["person_name", "person_descriptor", "living_thing", "robot"],
  wanted_place: ["place", "abstract", "other"],
  daily_object: ["usable_object", "wearable", "vehicle", "other"],
  favorite_food: ["food_drink", "living_thing", "other"],
  body: ["body_part", "illness", "other"],
  feeling: ["abstract", "word_expression", "other"],
  media: ["music", "viewable", "readable", "word_expression"],
  required_action: ["required_action", "action", "skill", "other"],
  forbidden_action: ["forbidden_action", "action", "other"]
};

export function suggestedCategories(contextId: LearningContextId) {
  return contextSuggestions[contextId].slice(0, 6);
}

export const categoryLabels: Record<ConceptCategory, string> = {
  famous_person: "有名な人",
  person_name: "人の名前",
  occupation: "職業",
  person_descriptor: "人を表す言葉",
  robot: "ロボット",
  action: "すること",
  required_action: "しなければならないこと",
  forbidden_action: "してはいけないこと",
  sport: "スポーツ",
  skill: "技",
  place: "行く場所",
  food_drink: "食べ物・飲み物",
  living_thing: "生き物",
  music: "音楽",
  viewable: "見るもの",
  readable: "読むもの",
  usable_object: "使うもの",
  wearable: "身につけるもの",
  vehicle: "乗り物",
  word_expression: "言葉・表現",
  body_part: "体の一部",
  illness: "病気",
  abstract: "抽象的なこと",
  other: "どれでもない"
};
