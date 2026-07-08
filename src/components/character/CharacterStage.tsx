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
