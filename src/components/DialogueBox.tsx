import { sanitizeGameText } from "../utils/sanitizeGameText";

type DialogueBoxProps = {
  speaker: string;
  text: string;
  variant?: "card" | "bubble";
  onNext?: () => void;
};

export function DialogueBox({ speaker, text, variant = "card", onNext }: DialogueBoxProps) {
  const displayText = sanitizeGameText(text);
  return (
    <section className={`dialogue-box ${variant === "bubble" ? "speech-bubble" : ""}`} aria-live="polite">
      <div className="speaker">{speaker}</div>
      <p className="dialogue-text">{displayText}</p>
      {onNext && <button className="next-indicator" type="button" aria-label="次へ" onClick={onNext}>▼</button>}
    </section>
  );
}
