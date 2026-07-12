import { useMemo, useState } from "react";
import type { Concept, ConceptCategory } from "../../domain/model/concept";
import { questionsForCategory } from "../../domain/learning/attributeQuestions";
import { categoryGroups, categoryLabels, suggestedCategories } from "../../domain/learning/categoryRouting";
import { transitionLearning, type LearningSession } from "../../domain/learning/learningMachine";
import { learningPrompts } from "../../data/learning-prompts/learningPrompts";
import { db } from "../../infrastructure/db/database";
import { ChoiceButtons } from "../../ui/components/ChoiceButtons";
import { DialogueBox } from "../../ui/components/DialogueBox";
import { ScreenHeader } from "../../ui/components/ScreenHeader";
import { CharacterStage } from "../../ui/components/CharacterStage";
import {
  beginLearning,
  cancelLearning,
  chooseLearningCategory,
  commitLearning,
  enterLearningText,
  setLearningAttributes,
  setLearningPreference
} from "./learningService";

export function TeachWordFlow({ concepts, initialSession, onChanged, onComplete }: {
  concepts: Concept[];
  initialSession: LearningSession | null;
  onChanged: () => Promise<void>;
  onComplete: () => void;
}) {
  const [session, setSession] = useState<LearningSession | null>(initialSession);
  const [input, setInput] = useState("");
  const [groupId, setGroupId] = useState("");
  const [saved, setSaved] = useState<Concept | null>(null);
  const [busy, setBusy] = useState(false);

  const active = session;
  const prompt = useMemo(() => {
    if (!active) return "今日はどんな言葉を覚えようかなっ？";
    return learningPrompts.find((item) => item.contextId === active.contextId)?.text ?? "新しい言葉を教えてくださいっ！";
  }, [active]);

  async function ensureSession() {
    if (session) return session;
    const contexts = ["room_object", "companion", "wanted_place", "favorite_food", "feeling"] as const;
    const contextId = concepts.filter((concept) => concept.source === "user").length === 0 ? "room_object" : contexts[Date.now() % contexts.length] ?? "feeling";
    const created = await beginLearning(contextId);
    setSession(created);
    return created;
  }

  async function submitText() {
    const current = await ensureSession();
    if (!input.trim()) return;
    const next = await enterLearningText(current, input);
    setSession(next);
    await onChanged();
  }

  async function selectCategory(category: ConceptCategory) {
    if (!active) return;
    let next = await chooseLearningCategory(active, category);
    const hasAttributeQuestion = questionsForCategory(category).some((question) => question.id !== "preference");
    if (!hasAttributeQuestion) next = await setLearningAttributes(next, {});
    setSession(next);
  }

  async function chooseAttribute(key: string, value: string) {
    if (!active) return;
    const next = await setLearningAttributes(active, { [key]: value });
    setSession(next);
  }

  async function choosePreference(value: string) {
    if (!active) return;
    const next = await setLearningPreference(active, Number(value) as -2 | -1 | 0 | 1 | 2);
    setSession(next);
  }

  async function commit() {
    if (!active) return;
    setBusy(true);
    try {
      const concept = await commitLearning(active);
      setSaved(concept);
      setSession(await db.learningSessions.get("active") ?? null);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    const contextId = active?.contextId ?? "room_object";
    await cancelLearning();
    const fresh = await beginLearning(contextId);
    setSession(fresh);
    setInput("");
    setGroupId("");
  }

  const state = active?.state ?? "contextual_prompt";
  const selectedCategory = active?.selectedCategory;
  const attributeQuestion = selectedCategory ? questionsForCategory(selectedCategory).find((question) => question.id !== "preference") : undefined;
  const duplicate = active?.duplicateConceptId ? concepts.find((concept) => concept.id === active.duplicateConceptId) : undefined;
  const learnedSurface = active?.normalizedInput || input;
  const dialogueText = saved
    ? `「${saved.surface}」っ！ アグリのノートへ入りましたァっ！`
    : state === "duplicate_resolution" && duplicate
      ? `前に覚えた「${duplicate.surface}」と同じ言葉ですかっ？`
      : state === "category_select"
        ? `「${learnedSurface}」って、どんな種類の言葉ですかっ？`
        : state === "category_attributes" && attributeQuestion
          ? `「${learnedSurface}」のこと、もうひとつ聞きますっ！ ${attributeQuestion.prompt}`
          : state === "preference_question"
            ? `「${learnedSurface}」は、どのくらい好きですかっ？`
            : state === "confirmation"
              ? `「${learnedSurface}」は、この覚え方で合っていますかっ？`
              : prompt;
  const progress = state === "category_select" ? 2 : ["category_attributes", "preference_question"].includes(state) ? 3 : state === "confirmation" || saved ? 4 : 1;
  const teachEmotion = saved ? "happy" : state === "duplicate_resolution" ? "confused" : state === "confirmation" ? "curious" : "excited";

  return (
    <main className="feature-screen teach-screen">
      <ScreenHeader title="言葉を教える" onBack={() => { void cancelLearning().then(onComplete); }} />
      <section className="teach-scene">
        <CharacterStage emotion={teachEmotion} locationId="room" timeOfDay="day" compact isSpeaking />
        <DialogueBox speaker="アグリちゃん" text={dialogueText} emotion={teachEmotion} />
      </section>
      <div className="teach-progress" aria-label={`言葉を教える手順 ${progress}/4`}>
        {[1, 2, 3, 4].map((step) => <span key={step} className={step <= progress ? "done" : ""}>{step}</span>)}
      </div>

      <section className="paper-panel teach-panel">
        {!active || ["contextual_prompt", "text_input"].includes(state) ? (
          <form onSubmit={(event) => { event.preventDefault(); void submitText(); }}>
            <label>教える言葉<input autoFocus maxLength={24} value={input} onChange={(event) => setInput(event.target.value)} placeholder="24文字まで" /></label>
            <button className="primary" type="submit" disabled={!input.trim()}>この言葉を教える</button>
          </form>
        ) : null}

        {state === "duplicate_resolution" && duplicate ? (
          <div className="button-stack">
            <button className="primary" type="button" onClick={() => { void cancelLearning().then(onComplete); }}>同じ言葉</button>
            <button type="button" onClick={() => { if (!active) return; const next = transitionLearning(active, { type: "DUPLICATE_SEPARATE" }, Date.now()); void db.learningSessions.put(next).then(() => setSession(next)); }}>別の言葉</button>
            <button type="button" onClick={() => void restart()}>入力し直す</button>
          </div>
        ) : null}

        {state === "category_select" ? (
          <div>
            <p className="panel-question">どんな種類の言葉として覚える？</p>
            {!groupId ? (
              <>
                <ChoiceButtons
                  options={categoryGroups.map((group) => ({ value: group.id, label: group.label }))}
                  onChoose={setGroupId}
                  label="大きな種類"
                />
                <p className="suggestion-row">候補: {suggestedCategories(active!.contextId).map((category) => <button key={category} type="button" onClick={() => void selectCategory(category)}>{categoryLabels[category]}</button>)}</p>
              </>
            ) : (
              <>
                <ChoiceButtons
                  options={(categoryGroups.find((group) => group.id === groupId)?.categories ?? []).map((category) => ({ value: category, label: categoryLabels[category] }))}
                  onChoose={(value) => void selectCategory(value)}
                  label="詳しい種類"
                />
                <button type="button" onClick={() => setGroupId("")}>ほかの種類</button>
              </>
            )}
          </div>
        ) : null}

        {state === "category_attributes" && attributeQuestion ? (
          <div>
            <p className="panel-question">{attributeQuestion.prompt}</p>
            <ChoiceButtons options={attributeQuestion.options} onChoose={(value) => void chooseAttribute(attributeQuestion.key, value)} />
          </div>
        ) : null}

        {state === "preference_question" ? (
          <div>
            <p className="panel-question">その言葉、どのくらい好き？</p>
            <ChoiceButtons options={questionsForCategory(selectedCategory ?? "other").find((question) => question.id === "preference")?.options ?? []} onChoose={(value) => void choosePreference(value)} />
          </div>
        ) : null}

        {state === "confirmation" ? (
          <div className="concept-card">
            <strong>{active?.normalizedInput}</strong>
            <span>{selectedCategory ? categoryLabels[selectedCategory] : "未分類"}</span>
            <button className="primary" type="button" disabled={busy} onClick={() => void commit()}>この覚え方で保存</button>
          </div>
        ) : null}

        {saved ? <button className="primary" type="button" onClick={() => { void cancelLearning().then(onComplete); }}>覚えた言葉を持って部屋へ戻る</button> : null}
        {!saved && active ? <div className="teach-secondary"><button type="button" onClick={() => void restart()}>入力し直す</button><button type="button" onClick={() => { void cancelLearning().then(onComplete); }}>やめる</button></div> : null}
      </section>
    </main>
  );
}
