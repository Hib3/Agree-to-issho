import { useEffect, useMemo, useState } from "react";
import { sanitizeGameText } from "../utils/sanitizeGameText";
import type { EmotionCode, GameSettings } from "../types/domain";

type DialogueBoxProps = {
  speaker: string;
  text: string;
  variant?: "card" | "bubble";
  emotionCode?: EmotionCode;
  onNext?: () => void;
  animateText?: boolean;
  textSpeed?: GameSettings["text_speed"];
};

const speedMs: Record<GameSettings["text_speed"], number> = { slow: 70, normal: 42, fast: 18 };

export function DialogueBox({ speaker, text, variant = "card", emotionCode = "normal_talk", onNext, animateText = false, textSpeed = "normal" }: DialogueBoxProps) {
  const safeText = useMemo(() => sanitizeGameText(text), [text]);
  const characters = useMemo(() => Array.from(safeText), [safeText]);
  const [visibleCount, setVisibleCount] = useState(animateText ? 0 : characters.length);
  const isComplete = visibleCount >= characters.length;

  useEffect(() => {
    setVisibleCount(animateText ? 0 : characters.length);
    if (!animateText || characters.length === 0) return;
    const timer = window.setInterval(() => {
      setVisibleCount((count) => {
        if (count >= characters.length) {
          window.clearInterval(timer);
          return count;
        }
        return count + 1;
      });
    }, speedMs[textSpeed]);
    return () => window.clearInterval(timer);
  }, [animateText, characters, textSpeed]);

  function handleAdvance() {
    if (!isComplete) {
      setVisibleCount(characters.length);
      return;
    }
    onNext?.();
  }

  const displayText = characters.slice(0, visibleCount).join("");
  return (
    <section className={`dialogue-box emotion-${emotionCode} ${variant === "bubble" ? "speech-bubble" : ""}`} aria-live="polite">
      <div className="speaker">{speaker}</div>
      <p className="dialogue-text">{displayText}</p>
      {onNext && (
        <button className="next-indicator" type="button" aria-label={isComplete ? "次へ" : "全文を表示"} onClick={handleAdvance}>
          {isComplete ? "▼" : "▶"}
        </button>
      )}
    </section>
  );
}
