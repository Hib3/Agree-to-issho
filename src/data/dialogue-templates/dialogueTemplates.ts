import type { DialogueTemplate, TemplateSlot } from "../schema/dialogue";
import { conceptCategories } from "../../domain/model/concept";
import type { ConversationIntent } from "../../domain/model/conversation";

type Frame = {
  id: string;
  slots: TemplateSlot[];
  text: string;
  intents: ConversationIntent[];
  grounding?: DialogueTemplate["grounding"];
  asksSituationFor?: ConversationIntent[];
};

const people = ["person_descriptor", "occupation", "person_name", "famous_person"] as const;
const actions = ["action", "required_action", "forbidden_action", "sport", "skill"] as const;
const objects = ["usable_object", "readable", "viewable"] as const;
const allCategories = [...conceptCategories];

const frames: Frame[] = [
  {
    id: "single_topic",
    slots: [slot("word", allCategories, "topic")],
    text: "「{word}」を、今日はもう一度思い出していましたっ。",
    intents: ["small_talk", "ask_meaning", "ask_preference", "recall_memory", "quiet_moment"]
  },
  {
    id: "person_daily_encounter",
    slots: [slot("person", [...people], "subject")],
    text: "「{person}」と偶然会った日のことを想像しましたっ。",
    intents: ["small_talk", "observation", "daydream", "ask_meaning", "ask_preference"],
    asksSituationFor: ["daydream"]
  },
  {
    id: "food_small_ritual",
    slots: [slot("food", ["food_drink"], "object")],
    text: "「{food}」を楽しむ前に、机の上を少し整える場面を考えましたっ。",
    intents: ["small_talk", "observation", "daydream", "ask_meaning", "ask_preference"],
    asksSituationFor: ["daydream"]
  },
  {
    id: "place_short_visit",
    slots: [slot("place", ["place"], "location")],
    text: "少し時間が空いた日に、「{place}」へ寄る場面を考えましたっ。",
    intents: ["invitation", "quiet_moment", "daydream", "ask_meaning", "ask_preference"],
    asksSituationFor: ["invitation", "daydream"]
  },
  {
    id: "object_missing_plan",
    slots: [slot("object", [...objects, "wearable", "vehicle"], "object")],
    text: "出かける前に「{object}」が見つからず、置いた場所を順番に思い出す場面ですっ。",
    intents: ["warning", "small_talk", "daydream", "ask_meaning", "ask_preference"],
    asksSituationFor: ["warning", "daydream"]
  },
  {
    id: "action_small_goal",
    slots: [slot("action", [...actions], "action")],
    text: "今日は「少しだけ{action:do}」という小さな目標を考えましたっ。",
    intents: ["small_talk", "discovery", "daydream", "ask_meaning", "ask_preference"],
    asksSituationFor: ["daydream"]
  },
  {
    id: "living_quiet_observation",
    slots: [slot("living", ["living_thing"], "subject")],
    text: "静かな時間に「{living}」の様子をそっと見る場面を思い浮かべましたっ。",
    intents: ["observation", "quiet_moment", "discovery", "ask_meaning", "ask_preference"]
  },
  {
    id: "word_pair_relation",
    slots: [slot("first", allCategories, "topic"), slot("second", allCategories, "topic")],
    text: "「{first}」と「{second}」の関係を、ノートで確かめていますっ。",
    intents: ["ask_relation"],
    grounding: "relation_required"
  },
  {
    id: "person_action_place",
    slots: [
      slot("person", [...people], "subject"),
      slot("action", [...actions], "action"),
      slot("place", ["place"], "location")
    ],
    text: "「{person}」が「{place}」で{action:doing}ところを想像しましたっ。",
    intents: ["small_talk", "daydream", "outing_report", "misunderstanding"],
    asksSituationFor: ["daydream", "misunderstanding"]
  },
  {
    id: "person_food_observation",
    slots: [slot("person", [...people], "subject"), slot("food", ["food_drink"], "object")],
    text: "「{person}」のそばに「{food}」がある場面を考えましたっ。",
    intents: ["observation", "rumor", "misunderstanding"],
    grounding: "relation_required"
  },
  {
    id: "place_object_discovery",
    slots: [slot("place", ["place"], "location"), slot("object", [...objects], "object")],
    text: "「{place}」で「{object}」を見つけた場面を思い浮かべましたっ。",
    intents: ["discovery", "outing_report", "misunderstanding"],
    asksSituationFor: ["misunderstanding"]
  },
  {
    id: "vehicle_container_message",
    slots: [slot("vehicle", ["vehicle"], "object"), slot("container", ["usable_object"], "container")],
    text: "「{vehicle}」で出かける前に、「{container}」へ何かをしまう場面を考えましたっ。",
    intents: ["daydream", "misunderstanding"],
    asksSituationFor: ["daydream", "misunderstanding"]
  },
  {
    id: "action_body_warning",
    slots: [slot("action", [...actions], "action"), slot("body", ["body_part"], "body_part")],
    text: "{action:doing}ときは、「{body}」を休ませたほうがよさそうです。",
    intents: ["warning", "misunderstanding"],
    asksSituationFor: ["misunderstanding"]
  },
  {
    id: "person_object_rumor",
    slots: [slot("person", [...people], "subject"), slot("object", [...objects], "object")],
    text: "「{person}」が「{object}」を大事にしている、という話を聞きましたっ。",
    intents: ["rumor", "ask_relation", "misunderstanding"],
    grounding: "relation_required"
  },
  {
    id: "time_feeling_memory",
    slots: [slot("time", ["other"], "topic"), slot("feeling", ["abstract"], "topic")],
    text: "「{time}」になると「{feeling}」を思い出す、という覚え方でしたっ。",
    intents: ["recall_memory", "quiet_moment", "ask_relation"],
    grounding: "relation_required"
  },
  {
    id: "food_place_invitation",
    slots: [slot("food", ["food_drink"], "object"), slot("place", ["place"], "location")],
    text: "「{place}」へ行って、「{food}」を一緒に楽しむところを想像しましたっ。",
    intents: ["invitation", "daydream"],
    asksSituationFor: ["invitation"]
  },
  {
    id: "object_action_plan",
    slots: [slot("object", [...objects], "object"), slot("action", [...actions], "action")],
    text: "「{object}」を用意して、{action:do}計画を考えましたっ。",
    intents: ["small_talk", "warning", "daydream"],
    grounding: "relation_required",
    asksSituationFor: ["daydream"]
  },
  {
    id: "wearable_person_comparison",
    slots: [slot("wearable", ["wearable"], "object"), slot("person", [...people], "companion")],
    text: "「{person}」に「{wearable}」が似合うか、比べて考えていましたっ。",
    intents: ["comparison", "ask_relation"],
    grounding: "relation_required"
  },
  {
    id: "living_place_observation",
    slots: [slot("living", ["living_thing"], "subject"), slot("place", ["place"], "location")],
    text: "「{place}」で「{living}」を見かける場面を思い浮かべましたっ。",
    intents: ["observation", "discovery", "outing_report"]
  },
  {
    id: "idea_comparison",
    slots: [slot("idea", ["abstract"], "topic"), slot("otherIdea", ["abstract", "word_expression"], "topic")],
    text: "「{idea}」と「{otherIdea}」の違いを、ノートで見比べていましたっ。",
    intents: ["comparison", "ask_relation"],
    grounding: "relation_required"
  },
  {
    id: "music_person_memory",
    slots: [slot("music", ["music"], "topic"), slot("person", [...people], "companion")],
    text: "「{music}」を聞いて「{person}」を思い出す、というつながりでしたっ。",
    intents: ["recall_memory", "ask_relation"],
    grounding: "relation_required"
  },
  {
    id: "body_action_discovery",
    slots: [slot("body", ["body_part"], "body_part"), slot("action", [...actions], "action")],
    text: "「{body}」を動かしながら{action:doing}場面を考えましたっ。",
    intents: ["discovery", "warning", "misunderstanding"],
    asksSituationFor: ["misunderstanding"]
  },
  {
    id: "vehicle_place_outing",
    slots: [slot("vehicle", ["vehicle"], "object"), slot("place", ["place"], "location")],
    text: "「{vehicle}」で「{place}」へ向かう道を思い浮かべましたっ。",
    intents: ["outing_report", "invitation", "daydream"],
    asksSituationFor: ["invitation"]
  },
  {
    id: "object_container_daydream",
    slots: [
      slot("object", [...objects, "food_drink"], "object"),
      slot("container", ["usable_object", "place"], "container")
    ],
    text: "「{container}」の中に「{object}」が入っている場面を想像しましたっ。",
    intents: ["daydream", "discovery", "misunderstanding"],
    asksSituationFor: ["daydream", "misunderstanding"]
  }
];

export const dialogueTemplates: DialogueTemplate[] = frames.flatMap((frame, frameIndex) =>
  frame.intents.map((intent, intentIndex) => {
    const asksQuestion =
      intent.startsWith("ask_") || intent === "misunderstanding" || frame.asksSituationFor?.includes(intent);
    return {
      id: `dialogue_${intent}_${frame.id}`,
      semanticFrame: `${intent}.${frame.id}`,
      grounding: frame.grounding ?? "scene_frame",
      intent,
      phase: "premise" as const,
      locations: rotateLocations(frameIndex + intentIndex),
      moods:
        intent === "quiet_moment"
          ? ["calm" as const, "sleepy" as const]
          : intent === "misunderstanding"
            ? ["confused" as const, "curious" as const]
            : ["curious" as const, "happy" as const],
      slots: frame.slots,
      constraints: { minUserWords: intent.startsWith("ask_") ? 1 : 0, maxRecentUse: 0 },
      variants: [frame.text],
      responsePatternIds: asksQuestion ? [`response_${(frameIndex * 17 + intentIndex) % 160}`] : [],
      cooldownSessions: 8
    };
  })
);

function slot(
  name: string,
  categories: TemplateSlot["categories"],
  grammaticalRole: TemplateSlot["grammaticalRole"]
): TemplateSlot {
  return { name, categories, grammaticalRole, required: true };
}

function rotateLocations(index: number) {
  const all = ["room", "street", "rooftop"];
  return index % 4 === 0
    ? all
    : [all[index % all.length] ?? "room", all[(index + 1) % all.length] ?? "street"];
}
