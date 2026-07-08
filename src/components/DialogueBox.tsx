type DialogueBoxProps = {
  speaker: string;
  text: string;
  variant?: "card" | "bubble";
  onNext?: () => void;
};

export function DialogueBox({ speaker, text, variant = "card", onNext }: DialogueBoxProps) {
  return (
    <section className={`dialogue-box ${variant === "bubble" ? "speech-bubble" : ""}`} aria-live="polite">
      <div className="speaker">{speaker}</div>
      <p>{text}</p>
      {onNext ? (
        <button className="next-indicator" type="button" aria-label="次へ" onClick={onNext}>▼</button>
      ) : (
        <span className="next-indicator decorative" aria-hidden="true">▼</span>
      )}
    </section>
  );
}
