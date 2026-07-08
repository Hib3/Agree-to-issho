import { FormEvent, useState } from "react";

type FirstStartWizardProps = {
  onComplete: (playerName: string, characterName: string) => void;
};

export function FirstStartWizard({ onComplete }: FirstStartWizardProps) {
  const [playerName, setPlayerName] = useState("");
  const [characterName, setCharacterName] = useState("アグリちゃん");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const player = playerName.trim();
    const character = characterName.trim() || "アグリちゃん";
    if (player) onComplete(player, character);
  }

  return (
    <main className="screen narrow-screen">
      <form className="panel form-stack" onSubmit={handleSubmit}>
        <h1>最初の設定</h1>
        <label htmlFor="player-name">
          プレイヤー名
          <input id="player-name" value={playerName} maxLength={24} onChange={(event) => setPlayerName(event.target.value)} />
        </label>
        <label htmlFor="character-name">
          キャラクター名
          <input id="character-name" value={characterName} maxLength={24} onChange={(event) => setCharacterName(event.target.value)} />
        </label>
        <button className="primary" type="submit" disabled={!playerName.trim()}>部屋へ入る</button>
      </form>
    </main>
  );
}
