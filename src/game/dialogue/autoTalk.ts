import type { ConversationSession, Screen } from "../../types/domain";
import type { RandomSource } from "./random";

type AutoTalkContext = {
  screen: Screen;
  enabled: boolean;
  hidden: boolean;
  busy: boolean;
  session: ConversationSession | null;
  lastUserInteractionAt?: string;
  now: number;
};

export function shouldScheduleAutoTalk(context: AutoTalkContext) {
  if (context.screen !== "main-room" || !context.enabled || context.hidden || context.busy) return false;
  if (context.session && context.session.phase !== "completed") return false;
  if (!context.lastUserInteractionAt) return true;
  return context.now - new Date(context.lastUserInteractionAt).getTime() >= 30000;
}

export function getAutoTalkDelay(random: RandomSource) {
  return 90000 + Math.floor(random.next() * 90001);
}
