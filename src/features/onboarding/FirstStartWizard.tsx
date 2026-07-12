import { useState } from "react";
import { safePlayerText } from "../../domain/grammar/japaneseNormalizer";
import { db } from "../../infrastructure/db/database";
import { CharacterStage } from "../../ui/components/CharacterStage";
import { DialogueBox } from "../../ui/components/DialogueBox";

export function FirstStartWizard({ onComplete }: { onComplete: () => Promise<void> }) {
  const [step, setStep] = useState<"hello" | "name" | "call">("hello");
  const [name, setName] = useState("");
  const [callName, setCallName] = useState("");
  const [busy, setBusy] = useState(false);
  const prompt = step === "hello" ? "まァっ、来てくれたんですね！ アグリですっ！" : step === "name" ? "あなたの名前を教えてくださいっ。" : "アグリは、あなたを何て呼べばいいですかっ？";

  async function finish() {
    const safeName = safePlayerText(name, 16);
    const safeCall = safePlayerText(callName || name, 16);
    if (!safeName || !safeCall) return;
    setBusy(true);
    const now = Date.now();
    await db.player.put({ id: "local", name: safeName, callName: safeCall, createdAt: now, updatedAt: now });
    await onComplete();
  }

  return (
    <main className="wizard-screen">
      <CharacterStage emotion="excited" locationId="room" />
      <DialogueBox speaker="アグリちゃん" text={prompt} />
      <section className="wizard-panel">
        {step === "hello" ? <button className="primary" type="button" onClick={() => setStep("name")}>はじめまして</button> : null}
        {step === "name" ? (
          <form onSubmit={(event) => { event.preventDefault(); if (safePlayerText(name, 16)) { setCallName(safePlayerText(name, 16)); setStep("call"); } }}>
            <label>あなたの名前<input autoFocus maxLength={16} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <button className="primary" type="submit" disabled={!safePlayerText(name, 16)}>次へ</button>
          </form>
        ) : null}
        {step === "call" ? (
          <form onSubmit={(event) => { event.preventDefault(); void finish(); }}>
            <label>呼ばれ方<input autoFocus maxLength={16} value={callName} onChange={(event) => setCallName(event.target.value)} /></label>
            <button className="primary" type="submit" disabled={busy || !safePlayerText(callName, 16)}>最初の言葉を教える</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
