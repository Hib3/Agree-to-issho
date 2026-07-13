import type { Location } from "../model/location";
import type { CharacterState } from "../model/character";
import type { Concept } from "../model/concept";
import { conversationIntents, type ConversationIntent, type ConversationSession } from "../model/conversation";
import { getTimeOfDay } from "../schedule/timeOfDay";

export type IntentBias = Partial<Record<ConversationIntent, number>>;

export function buildIntentBias(input: {
  concepts: Concept[];
  recentSessions: ConversationSession[];
  character: CharacterState;
  location: Location;
  now: number;
}): IntentBias {
  const bias = Object.fromEntries(conversationIntents.map((intent) => [intent, 0])) as Record<ConversationIntent, number>;
  for (const intent of input.location.preferredIntents) bias[intent] += 24;

  const learned = input.concepts.filter((concept) => concept.source === "user" && concept.active);
  const uncertain = learned.filter((concept) => concept.understanding < 0.58 || concept.ambiguity > 0.52);
  const stronglyFelt = learned.filter((concept) => Math.abs(concept.preference ?? 0) >= 2);
  if (learned.length === 0) bias.small_talk += 55;
  if (uncertain.length > 0) {
    bias.ask_meaning += 28;
    bias.ask_relation += 16;
    bias.misunderstanding += 8;
  }
  if (stronglyFelt.length > 0) bias.ask_preference += 24;
  if (input.recentSessions.length >= 2) bias.recall_memory += 20;
  if (input.character.boredom >= 55) {
    bias.discovery += 25;
    bias.daydream += 20;
  }
  const time = getTimeOfDay(input.now);
  if (time === "night") {
    bias.quiet_moment += 42;
    bias.recall_memory += 16;
  } else if (time === "morning") {
    bias.observation += 18;
    bias.invitation += 12;
  }
  return bias;
}
