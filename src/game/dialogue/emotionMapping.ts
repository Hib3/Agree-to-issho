import type { CharacterExpression, EmotionCode, MotionHint, SpeechAct } from "../../types/domain";

export function getEmotionCode(speechAct: SpeechAct, expression: CharacterExpression): EmotionCode {
  if (speechAct === "sleepy_reaction" || expression === "sleepy") return "sleepy";
  if (speechAct === "ask_correction" || expression === "confused") return "inquisitive";
  if (speechAct === "misunderstanding_joke") return "surprised";
  if (speechAct === "lonely_reaction" || expression === "lonely" || expression === "sad") return "sad_awkward";
  if (expression === "embarrassed") return "embarrassed";
  if (expression === "happy" || expression === "talk_smile") return "heart_warming";
  if (expression === "proud" || speechAct === "praise_user") return "proud";
  return "normal_talk";
}

export function getMotionHint(emotionCode: EmotionCode): MotionHint {
  const map: Record<EmotionCode, MotionHint> = {
    normal_talk: "none",
    heart_warming: "bounce",
    sad_awkward: "sway",
    surprised: "shake",
    inquisitive: "sway",
    sleepy: "sleepy",
    embarrassed: "sway",
    proud: "sparkle"
  };
  return map[emotionCode];
}
