import { sanitizeGameText } from "../utils/sanitizeGameText";
import type { EmotionCode } from "../types/domain";

type DialogueBoxProps = {
  speaker: string;
  text: string;
  variant?: "card" | "bubble";
  emotionCode?: EmotionCode;
  onNext?: () => void;
};

export function DialogueBox({ speaker, text, variant = "card", emotionCode = "normal_talk", onNext }: DialogueBoxProps) {
  const displayText = sanitizeGameText(text);
  return (
    <section className={`dialogue-box emotion-${emotionCode} ${variant === "bubble" ? "speech-bubble" : ""}`} aria-live="polite">
      <div className="speaker">{speaker}</div>
      <p className="dialogue-text">{displayText}</p>
      {onNext && <button className="next-indicator" type="button" aria-label="次へ" onClick={onNext}>▼</button>}
    </section>
  );
}
