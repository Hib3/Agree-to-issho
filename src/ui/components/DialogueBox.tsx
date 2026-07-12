import { useEffect, useMemo, useState } from "react";
import type { GameSettings } from "../../domain/model/player";
import type { CharacterEmotion } from "../../domain/model/character";
import { applyAguriVoice } from "../../domain/voice/aguriVoice";

type Props = {
  speaker: string;
  text: string;
  textSpeed?: GameSettings["textSpeed"];
  hasNext?: boolean;
  onNext?: () => void;
  emotion?: CharacterEmotion;
};

const speed = { slow: 70, normal: 42, fast: 18 } as const;

export function DialogueBox({ speaker, text, textSpeed = "normal", hasNext = false, onNext, emotion = "curious" }: Props) {
  const styledText = useMemo(() => applyAguriVoice(text, emotion), [emotion, text]);
  return <TypewriterDialogue key={styledText} speaker={speaker} text={styledText} textSpeed={textSpeed} hasNext={hasNext} {...(onNext ? { onNext } : {})} />;
}

function TypewriterDialogue({ speaker, text, textSpeed, hasNext, onNext }: {
  speaker: string;
  text: string;
  textSpeed: GameSettings["textSpeed"];
  hasNext: boolean;
  onNext?: () => void;
}) {
  const characters = useMemo(() => Array.from(text), [text]);
  const [visible, setVisible] = useState(0);
  const complete = visible >= characters.length;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisible((count) => {
        if (count >= characters.length) {
          window.clearInterval(timer);
          return count;
        }
        return count + 1;
      });
    }, speed[textSpeed]);
    return () => window.clearInterval(timer);
  }, [characters, textSpeed]);

  function advance() {
    if (!complete) {
      setVisible(characters.length);
      return;
    }
    onNext?.();
  }

  return (
    <section className="dialogue-box" aria-live="polite">
      <strong className="speaker-label">{speaker}</strong>
      <p>{characters.slice(0, visible).join("")}</p>
      {hasNext && onNext ? (
        <button className="dialogue-next" type="button" aria-label={complete ? "次へ" : "全文を表示"} onClick={advance}>
          {complete ? "▼" : "▶"}
        </button>
      ) : null}
    </section>
  );
}
