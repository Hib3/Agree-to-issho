import type { CharacterState } from "../model/character";
import type { Location } from "../model/location";
import type { RandomSource } from "../../infrastructure/random/random";
import { getTimeOfDay } from "./timeOfDay";

export type AutonomousContext = {
  screen: string;
  documentVisible: boolean;
  documentFocused: boolean;
  isBusy: boolean;
  isInputting: boolean;
  hasPendingAnswer: boolean;
  character: CharacterState;
  location: Location;
  now: number;
};

export function canScheduleAutonomousSpeech(context: AutonomousContext) {
  if (context.screen !== "room" || !context.documentVisible || !context.documentFocused) return false;
  if (context.isBusy || context.isInputting || context.hasPendingAnswer) return false;
  if (getTimeOfDay(context.now) === "night" && context.character.emotion === "sleepy") return false;
  return context.now - context.character.lastUserInteractionAt >= 12_000;
}

export function autonomousDelayMs(location: Location, random: RandomSource) {
  const [minimum, maximum] = location.autoSpeechRangeSeconds;
  return (minimum + Math.floor(random.next() * (maximum - minimum + 1))) * 1000;
}
