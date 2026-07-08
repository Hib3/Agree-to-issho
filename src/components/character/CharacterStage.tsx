import type { CharacterExpression } from "../../types/domain";
import { getCharacterImagePath, getFallbackCharacterImagePath } from "../../data/initial/assetManifest";

type CharacterStageProps = {
  name: string;
  expression: CharacterExpression;
  wordCount: number;
};

export function CharacterStage({ name, expression, wordCount }: CharacterStageProps) {
  const characterImage = `${import.meta.env.BASE_URL}${getCharacterImagePath(expression)}`;
  const fallbackImage = `${import.meta.env.BASE_URL}${getFallbackCharacterImagePath()}`;
  return (
    <section className={`character-stage mood-${expression}`} aria-label={`${name}の部屋`}>
      <div className="room-background" aria-hidden="true">
        <div className="room-window" />
        <div className="room-curtain curtain-left" />
        <div className="room-curtain curtain-right" />
        <div className="room-shelf" />
        <div className="room-stereo" />
        <div className="room-calendar" />
        <div className="room-low-table" />
        <div className="room-cushion" />
      </div>
      <div className="character-stand">
        <img
          src={characterImage}
          alt={name}
          onError={(event) => {
            if (event.currentTarget.src !== fallbackImage) event.currentTarget.src = fallbackImage;
          }}
        />
      </div>
      <p className="stage-note">覚えた言葉 {wordCount}こ</p>
    </section>
  );
}
