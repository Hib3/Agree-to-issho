import { useState } from "react";
import { DialogueBox } from "../components/DialogueBox";
import { TextInputPanel } from "../components/TextInputPanel";
import { createWordFrame, normalizeSurface } from "../game/word/createWordFrame";
import type { WordFrame } from "../types/domain";
import { MeaningQuestionFlow } from "./MeaningQuestionFlow";

type TeachWordFlowProps = {
  words: WordFrame[];
  onCancel: () => void;
  onSave: (word: WordFrame) => Promise<void>;
};

type Step = "input" | "category" | "emotion" | "situation" | "confirm";

export function TeachWordFlow({ words, onCancel, onSave }: TeachWordFlowProps) {
  const [step, setStep] = useState<Step>("input");
  const [word, setWord] = useState<WordFrame | null>(null);
  const [error, setError] = useState("");

  function handleInput(value: string) {
    const surface = normalizeSurface(value);
    const duplicate = words.find((item) => item.surface === surface);
    if (duplicate) {
      setError("同じ表記の言葉はすでに登録されています。");
      return;
    }
    setWord(createWordFrame(surface));
    setStep("category");
  }

  async function handleComplete() {
    if (!word) return;
    await onSave(word);
  }

  return (
    <main className="screen narrow-screen learn-screen">
      <header className="topbar paper-topbar">
        <button type="button" onClick={onCancel}>戻る</button>
        <strong>言葉を教える</strong>
        <span />
      </header>
      {step === "input" || !word ? (
        <section className="learn-card form-stack">
          <DialogueBox
            speaker="アグリちゃん"
            text={"新しい言葉っ！\nひとつ教えてくれるとうれしいよォっ！\n短くてもちゃんと覚えまァっすっ！"}
            variant="bubble"
          />
          <TextInputPanel label="教える言葉" submitLabel="質問へ" maxLength={32} onSubmit={handleInput}>
          {error && <p className="warning">{error}</p>}
          </TextInputPanel>
        </section>
      ) : (
        <MeaningQuestionFlow step={step} word={word} onStep={setStep} onWordChange={setWord} onComplete={handleComplete} />
      )}
    </main>
  );
}
