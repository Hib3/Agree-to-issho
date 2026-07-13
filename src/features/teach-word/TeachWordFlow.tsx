import { useMemo, useState } from "react";
import type { Concept, ConceptCategory } from "../../domain/model/concept";
import type { LocationId } from "../../domain/model/location";
import {
  answerLabel,
  attributeQuestionsForCategory,
  questionsForCategory
} from "../../domain/learning/attributeQuestions";
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
  answerLearningAttribute,
  cancelLearning,
  chooseLearningCategory,
  commitLearning,
  completeLearningAttributes,
  enterLearningText,
  setLearningPreference,
  setLearningReading
} from "./learningService";

export function TeachWordFlow({
  concepts,
  initialSession,
  locationId,
  onChanged,
  onComplete
}: {
  concepts: Concept[];
  initialSession: LearningSession | null;
  locationId: LocationId;
  onChanged: () => Promise<void>;
  onComplete: () => void;
}) {
  const [session, setSession] = useState<LearningSession | null>(initialSession);
  const [input, setInput] = useState("");
  const [groupId, setGroupId] = useState("");
  const [attributeSelection, setAttributeSelection] = useState("");
  const [reading, setReading] = useState(initialSession?.reading ?? "");
  const [saved, setSaved] = useState<Concept | null>(null);
  const [busy, setBusy] = useState(false);

  const active = session;
  const prompt = useMemo(() => {
    if (!active) return "今日はどんな言葉を覚えようかなっ？";
    return (
      learningPrompts.find((item) => item.contextId === active.contextId)?.text ??
      "新しい言葉を教えてくださいっ！"
    );
  }, [active]);

  async function ensureSession() {
    if (session) return session;
    const contexts = ["room_object", "companion", "wanted_place", "favorite_food", "feeling"] as const;
    const contextId =
      concepts.filter((concept) => concept.source === "user").length === 0
        ? "room_object"
        : (contexts[Date.now() % contexts.length] ?? "feeling");
    const created = await beginLearning(contextId, locationId);
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
    if (attributeQuestionsForCategory(category).length === 0) next = await completeLearningAttributes(next);
    setSession(next);
    setAttributeSelection("");
  }

  async function advanceAttribute() {
    if (!active || !attributeQuestion || !attributeSelection) return;
    const next = await answerLearningAttribute(
      active,
      attributeQuestion.key,
      attributeSelection,
      attributeQuestionIndex >= categoryAttributeQuestions.length - 1
    );
    setSession(next);
    setAttributeSelection("");
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
      const sessionWithReading =
        reading.trim() !== (active.reading ?? "") ? await setLearningReading(active, reading) : active;
      const concept = await commitLearning(sessionWithReading);
      setSaved(concept);
      setSession((await db.learningSessions.get("active")) ?? null);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    const contextId = active?.contextId ?? "room_object";
    await cancelLearning();
    const fresh = await beginLearning(contextId, active?.locationId ?? locationId);
    setSession(fresh);
    setInput("");
    setGroupId("");
    setAttributeSelection("");
    setReading("");
  }

  const state = active?.state ?? "contextual_prompt";
  const selectedCategory = active?.selectedCategory;
  const categoryAttributeQuestions = selectedCategory ? attributeQuestionsForCategory(selectedCategory) : [];
  const attributeQuestionIndex = active?.attributeQuestionIndex ?? 0;
  const attributeQuestion = categoryAttributeQuestions[attributeQuestionIndex];
  const preferenceQuestion = selectedCategory
    ? questionsForCategory(selectedCategory).find((question) => question.id === "preference")
    : undefined;
  const duplicate = active?.duplicateConceptId
    ? concepts.find((concept) => concept.id === active.duplicateConceptId)
    : undefined;
  const learnedSurface = active?.normalizedInput || input;
  const attributeSummary = categoryAttributeQuestions
    .filter((question) => Object.prototype.hasOwnProperty.call(active?.attributes ?? {}, question.key))
    .map((question) => ({
      id: question.id,
      prompt: question.prompt,
      answer: answerLabel(question, active?.attributes[question.key])
    }));

  const dialogueText = saved
    ? `「${saved.surface}」、しっかりノートに入りましたっ！`
    : state === "duplicate_resolution" && duplicate
      ? `前に覚えた「${duplicate.surface}」と同じ言葉ですかっ？`
      : state === "category_select"
        ? `「${learnedSurface}」って、どんな種類の言葉ですかっ？`
        : state === "category_attributes" && attributeQuestion
          ? `「${learnedSurface}」のこと、もうちょっと教えてっ！\n${attributeQuestion.prompt}`
          : state === "preference_question"
            ? `「${learnedSurface}」は、どのくらい好きですかっ？`
            : state === "confirmation"
              ? `「${learnedSurface}」は、この覚え方で合っていますかっ？`
              : prompt;
  const totalProgress = 4 + categoryAttributeQuestions.length;
  const progress =
    state === "category_select"
      ? 2
      : state === "category_attributes"
        ? 3 + attributeQuestionIndex
        : state === "preference_question"
          ? 3 + categoryAttributeQuestions.length
          : state === "confirmation" || saved
            ? totalProgress
            : 1;
  const teachEmotion = saved
    ? "happy"
    : state === "duplicate_resolution"
      ? "confused"
      : state === "confirmation"
        ? "curious"
        : "excited";

  return (
    <main className="feature-screen teach-screen">
      <ScreenHeader
        title="言葉を教える"
        onBack={() => {
          void cancelLearning().then(onComplete);
        }}
      />
      <section className="teach-scene">
        <CharacterStage
          emotion={teachEmotion}
          locationId={active?.locationId ?? locationId}
          timeOfDay="day"
          compact
          isSpeaking
        />
        <DialogueBox speaker="アグリちゃん" text={dialogueText} emotion={teachEmotion} />
      </section>
      <div
        className="teach-progress"
        aria-label={`言葉を教える手順 ${progress}/${totalProgress}`}
        style={{ gridTemplateColumns: `repeat(${totalProgress}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalProgress }, (_, index) => index + 1).map((step) => (
          <span key={step} className={step <= progress ? "done" : ""}>
            {step}
          </span>
        ))}
      </div>

      <section className="paper-panel teach-panel">
        {!active || ["contextual_prompt", "text_input"].includes(state) ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitText();
            }}
          >
            <label>
              教える言葉
              <input
                autoFocus
                maxLength={24}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="24文字まで"
              />
            </label>
            <button className="primary" type="submit" disabled={!input.trim()}>
              この言葉を教える
            </button>
          </form>
        ) : null}

        {state === "duplicate_resolution" && duplicate ? (
          <div className="button-stack">
            <button
              className="primary"
              type="button"
              onClick={() => {
                void cancelLearning().then(onComplete);
              }}
            >
              同じ言葉
            </button>
            <button
              type="button"
              onClick={() => {
                if (!active) return;
                const next = transitionLearning(active, { type: "DUPLICATE_SEPARATE" }, Date.now());
                void db.learningSessions.put(next).then(() => setSession(next));
              }}
            >
              別の言葉
            </button>
            <button type="button" onClick={() => void restart()}>
              入力し直す
            </button>
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
                <p className="suggestion-row">
                  候補:{" "}
                  {suggestedCategories(active!.contextId).map((category) => (
                    <button key={category} type="button" onClick={() => void selectCategory(category)}>
                      {categoryLabels[category]}
                    </button>
                  ))}
                </p>
              </>
            ) : (
              <>
                <ChoiceButtons
                  options={(categoryGroups.find((group) => group.id === groupId)?.categories ?? []).map(
                    (category) => ({ value: category, label: categoryLabels[category] })
                  )}
                  onChoose={(value) => void selectCategory(value)}
                  label="詳しい種類"
                />
                <button type="button" onClick={() => setGroupId("")}>
                  ほかの種類
                </button>
              </>
            )}
          </div>
        ) : null}

        {state === "category_attributes" && attributeQuestion ? (
          <div>
            <p className="panel-question">{attributeQuestion.prompt}</p>
            <ChoiceButtons
              options={attributeQuestion.options}
              value={attributeSelection}
              onChoose={setAttributeSelection}
              label={attributeQuestion.prompt}
            />
            {attributeSelection ? (
              <p className="learning-selection">
                今の答え: <strong>{answerLabel(attributeQuestion, attributeSelection)}</strong>
              </p>
            ) : null}
            <button
              className="primary learning-next"
              type="button"
              disabled={!attributeSelection}
              onClick={() => void advanceAttribute()}
            >
              {attributeQuestionIndex >= categoryAttributeQuestions.length - 1
                ? "好みの質問へ"
                : "次の質問へ"}
            </button>
          </div>
        ) : null}

        {state === "preference_question" ? (
          <div>
            <p className="panel-question">その言葉、どのくらい好き？</p>
            <ChoiceButtons
              options={preferenceQuestion?.options ?? []}
              onChoose={(value) => void choosePreference(value)}
            />
          </div>
        ) : null}

        {state === "confirmation" ? (
          <div className="concept-card">
            <strong>{active?.normalizedInput}</strong>
            <span>{selectedCategory ? categoryLabels[selectedCategory] : "未分類"}</span>
            {attributeSummary.length > 0 ? (
              <dl className="learning-summary">
                {attributeSummary.map((item) => (
                  <div key={item.id}>
                    <dt>{item.prompt}</dt>
                    <dd>{item.answer}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <label className="reading-field">
              読み方（任意）
              <input
                maxLength={24}
                value={reading}
                onChange={(event) => setReading(event.target.value)}
                placeholder="例: ほしがたくっきー"
              />
            </label>
            <button className="primary" type="button" disabled={busy} onClick={() => void commit()}>
              この覚え方で保存
            </button>
          </div>
        ) : null}

        {saved ? (
          <button
            className="primary"
            type="button"
            onClick={() => {
              void cancelLearning().then(onComplete);
            }}
          >
            覚えた言葉を持って部屋へ戻る
          </button>
        ) : null}
        {!saved && active ? (
          <div className="teach-secondary">
            <button type="button" onClick={() => void restart()}>
              入力し直す
            </button>
            <button
              type="button"
              onClick={() => {
                void cancelLearning().then(onComplete);
              }}
            >
              やめる
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
