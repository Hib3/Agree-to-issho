import type { DialogueTemplate, TemplateSlot } from "../schema/dialogue";
import { conversationIntents, type ConversationIntent } from "../../domain/model/conversation";

type Frame = { id: string; slots: TemplateSlot[]; text: string };

const people = ["person_descriptor", "occupation", "person_name", "famous_person"] as const;
const actions = ["action", "required_action", "forbidden_action", "sport", "skill"] as const;
const objects = ["usable_object", "readable", "viewable"] as const;

const frames: Frame[] = [
  { id: "person_action_place", slots: [slot("person", [...people], "subject"), slot("action", [...actions], "action"), slot("place", ["place"], "location")], text: "「{person}」が「{place}」で「{action}」の話をしていたら、どんな一日になるんでしょう。" },
  { id: "person_food_observation", slots: [slot("person", [...people], "subject"), slot("food", ["food_drink"], "object")], text: "「{person}」のそばに「{food}」があったら、ちょっと機嫌がよさそうです。" },
  { id: "place_object_discovery", slots: [slot("place", ["place"], "location"), slot("object", [...objects], "object")], text: "「{place}」で「{object}」を見つけたら、誰が置いたのか気になりますっ。" },
  { id: "vehicle_container_message", slots: [slot("vehicle", ["vehicle"], "object"), slot("container", ["usable_object", "place"], "container")], text: "「{vehicle}」で出かける日に、「{container}」へ短い手紙をしまっておきたいです。" },
  { id: "action_body_warning", slots: [slot("action", [...actions], "action"), slot("body", ["body_part"], "body_part")], text: "「{action}」に夢中な日は、「{body}」を休ませるのも忘れないでくださいね。" },
  { id: "person_object_rumor", slots: [slot("person", [...people], "subject"), slot("object", [...objects], "object")], text: "「{person}」が「{object}」を大事にしているって聞いたら、理由を知りたくなります。" },
  { id: "time_feeling_memory", slots: [slot("time", ["other"], "object"), slot("feeling", ["abstract"], "object")], text: "「{time}」になると「{feeling}」を思い出す日って、たまにありますよね。" },
  { id: "food_place_invitation", slots: [slot("food", ["food_drink"], "object"), slot("place", ["place"], "location")], text: "「{place}」へ行くなら、「{food}」を一緒に楽しむ時間も作りたいですっ。" },
  { id: "object_action_plan", slots: [slot("object", [...objects], "object"), slot("action", [...actions], "action")], text: "「{action}」の日には「{object}」を用意すると、少し落ち着いて始められそうです。" },
  { id: "wearable_person_comparison", slots: [slot("wearable", ["wearable"], "object"), slot("person", [...people], "companion")], text: "「{wearable}」は「{person}」にも似合うかなって、こっそり考えていました。" },
  { id: "living_place_observation", slots: [slot("living", ["living_thing"], "subject"), slot("place", ["place"], "location")], text: "「{place}」で「{living}」を見かけたら、少し立ち止まって見ていたいです。" },
  { id: "idea_comparison", slots: [slot("idea", ["abstract"], "subject"), slot("otherIdea", ["abstract", "word_expression"], "object")], text: "「{idea}」と「{otherIdea}」は、遠そうで少し似ている気がします。" },
  { id: "music_person_memory", slots: [slot("music", ["music"], "object"), slot("person", [...people], "companion")], text: "「{music}」を聞くとき、「{person}」のことまで思い出すかもしれません。" },
  { id: "body_action_discovery", slots: [slot("body", ["body_part"], "body_part"), slot("action", [...actions], "action")], text: "「{body}」を動かしながら「{action}」すると、新しいコツが見つかりそうです。" },
  { id: "vehicle_place_outing", slots: [slot("vehicle", ["vehicle"], "object"), slot("place", ["place"], "location")], text: "「{vehicle}」で「{place}」へ向かう道を、アグリの地図にも描いておきたいです。" },
  { id: "object_container_daydream", slots: [slot("object", [...objects, "food_drink"], "object"), slot("container", ["usable_object", "place"], "container")], text: "「{container}」の中に「{object}」があったら、開ける前から少しわくわくしますっ。" }
];

const relationRequiredFrames = new Set([
  "person_food_observation",
  "person_object_rumor",
  "time_feeling_memory",
  "wearable_person_comparison",
  "idea_comparison",
  "music_person_memory"
]);

const intentOpeners: Record<ConversationIntent, string> = {
  small_talk: "そういえばっ、",
  ask_meaning: "言葉の輪郭を考えていたら、",
  ask_preference: "好きなものの話として、",
  ask_relation: "ノートの線をたどったら、",
  recall_memory: "前のページを開いたら、",
  rumor: "小さな噂なんですけど、",
  observation: "さっき眺めていて、",
  warning: "ちょっと気をつけたいのが、",
  invitation: "今度の誘いとして、",
  discovery: "まァっ、発見したんですけど、",
  comparison: "二つを比べてみたら、",
  daydream: "ぼんやり想像したんですけど、",
  misunderstanding: "なんかっ、アグリの覚え方だと、",
  outing_report: "帰ってから思い出したのが、",
  quiet_moment: "静かにしていると、"
};

export const dialogueTemplates: DialogueTemplate[] = conversationIntents.flatMap((intent, intentIndex) =>
  frames.map((frame, frameIndex) => ({
    id: `dialogue_${intent}_${frame.id}`,
    semanticFrame: `${intent}.${frame.id}`,
    grounding: relationRequiredFrames.has(frame.id) ? "relation_required" as const : "scene_frame" as const,
    intent,
    phase: "premise" as const,
    locations: rotateLocations(intentIndex + frameIndex),
    moods: intent === "quiet_moment" ? ["calm" as const, "sleepy" as const] : intent === "misunderstanding" ? ["confused" as const, "curious" as const] : ["curious" as const, "happy" as const],
    slots: frame.slots,
    constraints: { minUserWords: intentIndex % 3 === 0 ? 1 : 0, maxRecentUse: 0 },
    variants: [
      `${intentOpeners[intent]}${frame.text}`,
      `${intentOpeners[intent]}${frame.text} ${intent === "warning" ? "無理はしないでくださいね。" : "アグリはもう少し知りたいですっ。"}`
    ],
    responsePatternIds: (intentIndex + frameIndex) % 3 === 0 ? [`response_${(intentIndex * frames.length + frameIndex) % 160}`] : [],
    cooldownSessions: 8
  }))
);

function slot(name: string, categories: TemplateSlot["categories"], grammaticalRole: TemplateSlot["grammaticalRole"]): TemplateSlot {
  return { name, categories, grammaticalRole, required: true };
}

function rotateLocations(index: number) {
  const all = ["room", "street", "rooftop"];
  return index % 4 === 0 ? all : [all[index % all.length] ?? "room", all[(index + 1) % all.length] ?? "street"];
}
