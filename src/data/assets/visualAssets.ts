import type { CharacterEmotion } from "../../domain/model/character";
import type { LocationId } from "../../domain/model/location";
import type { TimeOfDay } from "../../domain/schedule/timeOfDay";

const base = import.meta.env.BASE_URL;

const restingCharacterFiles: Record<CharacterEmotion, string> = {
  calm: "aguri_normal.png",
  curious: "aguri_thinking.png",
  happy: "aguri_proud.png",
  excited: "aguri_surprised.png",
  embarrassed: "aguri_embarrassed.png",
  confused: "aguri_confused.png",
  lonely: "aguri_lonely.png",
  sleepy: "aguri_sleepy.png"
};

const speakingCharacterFiles: Partial<Record<CharacterEmotion, string>> = {
  calm: "aguri_talk_normal.png",
  curious: "aguri_talk_normal.png",
  happy: "aguri_talk_happy.png",
  excited: "aguri_surprised.png"
};

export function characterImageFor(emotion: CharacterEmotion, isSpeaking = false, isBlinking = false) {
  const file = isBlinking && emotion === "calm"
    ? "aguri_idle_blink.png"
    : isSpeaking
      ? speakingCharacterFiles[emotion] ?? restingCharacterFiles[emotion]
      : restingCharacterFiles[emotion];
  return `${base}assets/characters/main/fullbody/approved/${file}`;
}

export const fallbackCharacterImage = `${base}assets/characters/main/fullbody/approved/aguri_normal.png`;

export function sceneBackgroundFor(location: LocationId, time: TimeOfDay, weather: "clear" | "rain" = "clear") {
  if (location === "street") return `${base}assets/backgrounds/aguri_street_day.webp`;
  if (location === "rooftop") return `${base}assets/backgrounds/aguri_rooftop_evening.webp`;
  if (weather === "rain") return `${base}assets/backgrounds/aguri_room_rainy.webp`;
  if (time === "night") return `${base}assets/backgrounds/aguri_room_night.webp`;
  if (time === "evening") return `${base}assets/backgrounds/aguri_room_evening.webp`;
  return `${base}assets/backgrounds/aguri_room_day.webp`;
}
