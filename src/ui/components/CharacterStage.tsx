import type { CSSProperties } from "react";
import type { CharacterEmotion } from "../../domain/model/character";
import type { LocationId } from "../../domain/model/location";
import type { TimeOfDay } from "../../domain/schedule/timeOfDay";
import { characterImageFor, fallbackCharacterImage, sceneBackgroundFor } from "../../data/assets/visualAssets";

export function CharacterStage({ emotion, locationId, timeOfDay = "day", reducedMotion = false, isSpeaking = false, compact = false }: {
  emotion: CharacterEmotion;
  locationId: LocationId;
  timeOfDay?: TimeOfDay;
  reducedMotion?: boolean;
  isSpeaking?: boolean;
  compact?: boolean;
}) {
  const image = characterImageFor(emotion);
  const style = { "--scene-background": `url("${sceneBackgroundFor(locationId, timeOfDay)}")` } as CSSProperties;
  return (
    <div className={`character-stage location-${locationId} mood-${emotion}${compact ? " compact" : ""}${isSpeaking ? " speaking" : ""}`} style={style} aria-label="アグリちゃんのいる場所">
      <div className="scene-light" aria-hidden="true" />
      <img
        key={image}
        className={reducedMotion ? "character still" : "character"}
        src={image}
        alt={`アグリちゃん・${emotion}`}
        onError={(event) => { event.currentTarget.src = fallbackCharacterImage; }}
      />
    </div>
  );
}
