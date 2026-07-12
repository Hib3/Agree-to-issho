import type { CharacterEmotion } from "../../domain/model/character";
import type { LocationId } from "../../domain/model/location";
import type { TimeOfDay } from "../../domain/schedule/timeOfDay";

const base = import.meta.env.BASE_URL;

const characterFiles: Record<CharacterEmotion, string> = {
  calm: "aguri_normal.png",
  curious: "aguri_thinking.png",
  happy: "aguri_talk_happy.png",
  excited: "aguri_talk_happy.png",
  embarrassed: "aguri_confused.png",
  confused: "aguri_confused.png",
  lonely: "aguri_normal.png",
  sleepy: "aguri_sleepy.png"
};

export function characterImageFor(emotion: CharacterEmotion) {
  return `${base}assets/characters/main/fullbody/approved/${characterFiles[emotion]}`;
}

export const fallbackCharacterImage = `${base}assets/characters/main/fullbody/approved/aguri_normal.png`;

export function sceneBackgroundFor(location: LocationId, time: TimeOfDay) {
  if (location === "street") return `${base}assets/backgrounds/aguri_street_day.webp`;
  if (location === "rooftop") return `${base}assets/backgrounds/aguri_rooftop_evening.webp`;
  if (time === "night") return `${base}assets/backgrounds/aguri_room_night.webp`;
  if (time === "evening") return `${base}assets/backgrounds/aguri_room_evening.webp`;
  return `${base}assets/backgrounds/aguri_room_day.webp`;
}
