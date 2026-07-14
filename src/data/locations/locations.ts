import type { Location } from "../../domain/model/location";

export const locations: Location[] = [
  {
    id: "room",
    name: "小さな部屋",
    description: "木の机とノートがある、いつもの部屋",
    preferredIntents: ["small_talk", "ask_meaning", "ask_preference", "quiet_moment", "recall_memory"],
    timeWindows: ["morning", "day", "evening", "night"],
    autoSpeechRangeSeconds: [25, 50],
    npcCandidates: ["配達の人", "近所の学生"]
  },
  {
    id: "street",
    name: "並木道",
    description: "小さな店と街路樹が続く帰り道",
    preferredIntents: ["observation", "discovery", "rumor", "invitation", "outing_report"],
    timeWindows: ["morning", "day", "evening"],
    autoSpeechRangeSeconds: [20, 42],
    npcCandidates: ["花屋の店員", "散歩中の人"]
  },
  {
    id: "rooftop",
    name: "星見の屋上",
    description: "風と空の色をゆっくり眺められる場所",
    preferredIntents: ["daydream", "comparison", "quiet_moment", "recall_memory", "warning"],
    timeWindows: ["day", "evening", "night"],
    autoSpeechRangeSeconds: [32, 60],
    npcCandidates: ["天体観測の人"]
  }
];
