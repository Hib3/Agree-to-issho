import { ChoiceButtons } from "../components/ChoiceButtons";
import { DialogueBox } from "../components/DialogueBox";
import type { EmotionTag, SituationTag, WordCategory, WordFrame } from "../types/domain";
import { applyCategory, applyEmotion, applySituation } from "../game/word/createWordFrame";
import { WordCategorySelector, wordCategoryLabels } from "./WordCategorySelector";

type MeaningStep = "category" | "emotion" | "situation" | "confirm";

type MeaningQuestionFlowProps = {
  step: MeaningStep;
  word: WordFrame;
  onStep: (step: MeaningStep) => void;
  onWordChange: (word: WordFrame) => void;
  onComplete: () => void;
};

const emotionLabels: Record<EmotionTag, string> = {
  happy: "好き",
  sad: "かなしい",
  curious: "気になる",
  lonely: "さみしい",
  sleepy: "ねむい",
  embarrassed: "照れる",
  proud: "大事",
  neutral: "ふつう"
};

const situationLabels: Record<SituationTag, string> = {
  greeting: "あいさつ",
  daily_talk: "日常",
  room: "部屋",
  memory: "思い出",
  question: "質問",
  diary: "日記",
  event: "できごと",
  unknown: "まだ不明"
};

export function MeaningQuestionFlow({ step, word, onStep, onWordChange, onComplete }: MeaningQuestionFlowProps) {
  if (step === "category") {
    return (
      <section className="learn-card form-stack">
        <DialogueBox speaker="アグリちゃん" text={`「${word.surface}」って、どんな種類の言葉かな？`} variant="bubble" />
        <WordCategorySelector value={word.category} onChange={(category) => onWordChange(applyCategory(word, category))} />
        <p className="selection-summary">今の覚え方: {wordCategoryLabels[word.category]}</p>
        <button className="primary" type="button" onClick={() => onStep("emotion")}>次へ</button>
      </section>
    );
  }

  if (step === "emotion") {
    const value = word.emotion_tags[0] ?? "neutral";
    return (
      <section className="learn-card form-stack">
        <DialogueBox speaker="アグリちゃん" text="その言葉に近い気持ちはどれ？ あとで選び直しても大丈夫だよ。" variant="bubble" />
        <ChoiceButtons<EmotionTag>
          value={value}
          ariaLabel="気持ちを選ぶ"
          options={[
            { value: "happy", label: "好き" },
            { value: "curious", label: "気になる" },
            { value: "sad", label: "かなしい" },
            { value: "embarrassed", label: "照れる" },
            { value: "proud", label: "大事" },
            { value: "neutral", label: "ふつう" }
          ]}
          onChoose={(emotion) => {
            const nextWord = applyEmotion(word, emotion, emotion === "sad" ? "dislike" : emotion === "happy" ? "like" : "neutral");
            onWordChange({ ...nextWord, emotion_tags: [emotion] });
          }}
        />
        <p className="selection-summary">今の気持ち: {emotionLabels[value]}</p>
        <div className="form-actions">
          <button type="button" onClick={() => onStep("category")}>戻る</button>
          <button className="primary" type="button" onClick={() => onStep("situation")}>次へ</button>
        </div>
      </section>
    );
  }

  if (step === "situation") {
    const value = word.situation_tags[0] ?? "daily_talk";
    return (
      <section className="learn-card form-stack">
        <DialogueBox speaker="アグリちゃん" text="それ、どんな時に思い出す言葉？" variant="bubble" />
        <ChoiceButtons<SituationTag>
          value={value}
          ariaLabel="場面を選ぶ"
          options={[
            { value: "greeting", label: "あいさつ" },
            { value: "daily_talk", label: "日常" },
            { value: "room", label: "部屋" },
            { value: "memory", label: "思い出" },
            { value: "diary", label: "日記" },
            { value: "unknown", label: "まだ不明" }
          ]}
          onChoose={(situation) => {
            const nextWord = applySituation(word, situation);
            onWordChange({ ...nextWord, situation_tags: [situation], affordances: [`talk:${situation}`] });
          }}
        />
        <p className="selection-summary">思い出す場面: {situationLabels[value]}</p>
        <div className="form-actions">
          <button type="button" onClick={() => onStep("emotion")}>戻る</button>
          <button className="primary" type="button" onClick={() => onStep("confirm")}>次へ</button>
        </div>
      </section>
    );
  }

  return (
    <section className="learn-card form-stack">
      <DialogueBox speaker="アグリちゃん" text="ここまでをメモにしておくね。違っていたら戻って直せるよ。" variant="bubble" />
      <dl className="summary-list aguri-memo">
        <div><dt>言葉</dt><dd>{word.surface}</dd></div>
        <div>
          <dt>種類</dt>
          <dd>{wordCategoryLabels[word.category]}</dd>
        </div>
        <div><dt>気持ち</dt><dd>{word.emotion_tags.map((emotion) => emotionLabels[emotion]).join("、") || "ふつう"}</dd></div>
        <div><dt>場面</dt><dd>{word.situation_tags.map((situation) => situationLabels[situation]).join("、") || "日常"}</dd></div>
        <div><dt>わかった度</dt><dd>{Math.round(word.confidence * 100)}%</dd></div>
      </dl>
      <div className="form-actions">
        <button type="button" onClick={() => onStep("situation")}>戻る</button>
        <button className="primary" type="button" onClick={onComplete}>この端末に保存</button>
      </div>
    </section>
  );
}
