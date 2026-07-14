import { useEffect, useState, type CSSProperties } from "react";
import type { CharacterEmotion } from "../../domain/model/character";
import type { LocationId } from "../../domain/model/location";
import type { TimeOfDay } from "../../domain/schedule/timeOfDay";
import {
  characterImageFor,
  fallbackCharacterImage,
  sceneBackgroundFor
} from "../../data/assets/visualAssets";

export function CharacterStage({
  emotion,
  locationId,
  timeOfDay = "day",
  weather = "clear",
  reducedMotion = false,
  isSpeaking = false,
  compact = false
}: {
  emotion: CharacterEmotion;
  locationId: LocationId;
  timeOfDay?: TimeOfDay;
  weather?: "clear" | "rain";
  reducedMotion?: boolean;
  isSpeaking?: boolean;
  compact?: boolean;
}) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [idlePosition, setIdlePosition] = useState<"center" | "left" | "right">("center");
  const blinkEnabled = !reducedMotion && !isSpeaking && emotion === "calm";
  const image = characterImageFor(emotion, isSpeaking, blinkEnabled && isBlinking);
  const style = {
    "--scene-background": `url("${sceneBackgroundFor(locationId, timeOfDay, weather)}")`
  } as CSSProperties;

  useEffect(() => {
    if (!blinkEnabled) return;
    let closeTimer = 0;
    const resetTimer = window.setTimeout(() => setIsBlinking(false), 0);
    const blinkTimer = window.setInterval(() => {
      setIsBlinking(true);
      closeTimer = window.setTimeout(() => setIsBlinking(false), 180);
    }, 5_200);
    return () => {
      window.clearInterval(blinkTimer);
      window.clearTimeout(closeTimer);
      window.clearTimeout(resetTimer);
    };
  }, [blinkEnabled]);

  useEffect(() => {
    if (reducedMotion || isSpeaking || compact) {
      const resetTimer = window.setTimeout(() => setIdlePosition("center"), 0);
      return () => window.clearTimeout(resetTimer);
    }
    const positions = ["center", "left", "center", "right"] as const;
    let index = 0;
    const movementTimer = window.setInterval(() => {
      index = (index + 1) % positions.length;
      setIdlePosition(positions[index] ?? "center");
    }, 7_200);
    return () => window.clearInterval(movementTimer);
  }, [compact, isSpeaking, reducedMotion]);

  return (
    <div
      className={`character-stage location-${locationId} time-${timeOfDay} weather-${weather} mood-${emotion} idle-${idlePosition}${compact ? " compact" : ""}${isSpeaking ? " speaking" : ""}`}
      style={style}
      aria-label="アグリちゃんのいる場所"
    >
      <div className="scene-light" aria-hidden="true" />
      <img
        key={image}
        className={reducedMotion ? "character still" : "character"}
        src={image}
        alt={`アグリちゃん・${emotion}`}
        onError={(event) => {
          event.currentTarget.src = fallbackCharacterImage;
        }}
      />
    </div>
  );
}
