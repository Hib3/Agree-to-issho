import type { CharacterEmotion } from "../../domain/model/character";
import type { LocationId } from "../../domain/model/location";

export function CharacterStage({ emotion, locationId, reducedMotion = false }: { emotion: CharacterEmotion; locationId: LocationId; reducedMotion?: boolean }) {
  const image = `${import.meta.env.BASE_URL}assets/characters/main/fullbody/approved/aguri_normal.png`;
  return (
    <div className={`character-stage location-${locationId} mood-${emotion}`} aria-label="アグリちゃんのいる場所">
      <div className="scene-sky" aria-hidden="true" />
      <div className="scene-window" aria-hidden="true" />
      <div className="scene-furniture" aria-hidden="true" />
      <div className="scene-plant" aria-hidden="true" />
      <img className={reducedMotion ? "character still" : "character"} src={image} alt="アグリちゃん" />
    </div>
  );
}
