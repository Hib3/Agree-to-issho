import { ChoiceButtons } from "../components/ChoiceButtons";
import { DialogueBox } from "../components/DialogueBox";
import type { EmotionTag, SituationTag, WordCategory, WordFrame } from "../types/domain";
import { applyCategory, applyEmotion, applySituation } from "../game/word/createWordFrame";
import { WordCategorySelector, wordCategoryLabels } from "./WordCategorySelector";

type MeaningStep = "category" | "detail" | "emotion" | "situation" | "confirm";

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
        <button className="primary" type="button" onClick={() => onStep("detail")}>次へ</button>
      </section>
    );
  }

  if (step === "detail") {
    const detail = getCategoryDetail(word.category);
    return (
      <section className="learn-card form-stack">
        <DialogueBox speaker="アグリちゃん" text={detail.prompt} variant="bubble" />
        <ChoiceButtons<string>
          value={detail.getValue(word)}
          ariaLabel="詳しい覚え方を選ぶ"
          options={detail.options}
          onChoose={(value) => onWordChange(detail.apply(word, value))}
        />
        <p className="selection-summary">詳しいメモ: {detail.getLabel(word)}</p>
        <div className="form-actions">
          <button type="button" onClick={() => onStep("category")}>戻る</button>
          <button className="primary" type="button" onClick={() => onStep("emotion")}>次へ</button>
        </div>
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
          <button type="button" onClick={() => onStep("detail")}>戻る</button>
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
        <div><dt>メモ</dt><dd>{getMeaningMemo(word)}</dd></div>
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

type CategoryDetail = {
  prompt: string;
  options: Array<{ value: string; label: string }>;
  getValue: (word: WordFrame) => string;
  getLabel: (word: WordFrame) => string;
  apply: (word: WordFrame, value: string) => WordFrame;
};

function getCategoryDetail(category: WordCategory): CategoryDetail {
  if (category === "person") {
    return relationDetail("その人は、あなたの近くにいる人？", [
      ["near", "近い人"],
      ["famous", "有名な人"],
      ["unknown", "まだ不明"]
    ]);
  }
  if (category === "action") {
    return emotionDetail("それをするのは、どんな感じ？", [
      ["happy", "楽しい"],
      ["sleepy", "疲れる"],
      ["proud", "大事"],
      ["sad", "こわい"],
      ["neutral", "まだ不明"]
    ]);
  }
  if (category === "place") {
    return placeDetail();
  }
  if (category === "food") {
    return foodDetail();
  }
  if (category === "object") {
    return objectDetail();
  }
  if (category === "feeling") {
    return feelingDetail();
  }
  if (category === "unknown") {
    return unknownDetail();
  }
  return relationDetail("もう少しだけ、どんな言葉か仮メモしておく？", [
    ["daily", "日常"],
    ["important", "大事"],
    ["unknown", "まだ不明"]
  ]);
}

function relationDetail(prompt: string, values: Array<[string, string]>): CategoryDetail {
  return {
    prompt,
    options: values.map(([value, label]) => ({ value, label })),
    getValue: (word) => word.relation_tags[0] ?? "unknown",
    getLabel: (word) => values.find(([value]) => value === word.relation_tags[0])?.[1] ?? "まだ不明",
    apply: (word, value) => ({ ...word, relation_tags: [value], source_question_ids: unique([...word.source_question_ids, "ask_category_detail"]) })
  };
}

function emotionDetail(prompt: string, values: Array<[EmotionTag, string]>): CategoryDetail {
  return {
    prompt,
    options: values.map(([value, label]) => ({ value, label })),
    getValue: (word) => word.emotion_tags[0] ?? "neutral",
    getLabel: (word) => values.find(([value]) => value === word.emotion_tags[0])?.[1] ?? "まだ不明",
    apply: (word, value) => ({ ...word, emotion_tags: [value as EmotionTag], affordances: unique([...word.affordances, `detail:${value}`]), source_question_ids: unique([...word.source_question_ids, "ask_category_detail"]) })
  };
}

function placeDetail(): CategoryDetail {
  return {
    prompt: "そこは、行ってみたい場所？",
    options: [
      { value: "want_to_go", label: "行きたい" },
      { value: "calm", label: "落ち着く" },
      { value: "event", label: "にぎやか" },
      { value: "unknown", label: "まだ不明" }
    ],
    getValue: (word) => word.relation_tags[0] ?? "unknown",
    getLabel: (word) => ({ want_to_go: "行きたい", calm: "落ち着く", event: "にぎやか", unknown: "まだ不明" })[word.relation_tags[0] ?? "unknown"] ?? "まだ不明",
    apply: (word, value) => ({ ...word, relation_tags: [value], situation_tags: unique([...word.situation_tags, value === "event" ? "event" : "memory"]), source_question_ids: unique([...word.source_question_ids, "ask_category_detail"]) })
  };
}

function foodDetail(): CategoryDetail {
  return {
    prompt: "それは、おいしそう？",
    options: [
      { value: "like", label: "好き" },
      { value: "dislike", label: "苦手" },
      { value: "curious", label: "気になる" },
      { value: "unknown", label: "まだ不明" }
    ],
    getValue: (word) => word.user_stance === "unknown" ? "unknown" : word.user_stance,
    getLabel: (word) => ({ like: "好き", dislike: "苦手", neutral: "ふつう", unknown: "まだ不明" })[word.user_stance] ?? "気になる",
    apply: (word, value) => ({ ...word, user_stance: value === "curious" ? "neutral" : value as WordFrame["user_stance"], emotion_tags: [value === "dislike" ? "sad" : value === "like" ? "happy" : "curious"], source_question_ids: unique([...word.source_question_ids, "ask_category_detail"]) })
  };
}

function objectDetail(): CategoryDetail {
  return {
    prompt: "それは、どこにありそう？",
    options: [
      { value: "room", label: "部屋" },
      { value: "outside", label: "外" },
      { value: "belonging", label: "持ちもの" },
      { value: "unknown", label: "まだ不明" }
    ],
    getValue: (word) => word.relation_tags[0] ?? "unknown",
    getLabel: (word) => ({ room: "部屋", outside: "外", belonging: "持ちもの", unknown: "まだ不明" })[word.relation_tags[0] ?? "unknown"] ?? "まだ不明",
    apply: (word, value) => ({ ...word, relation_tags: [value], situation_tags: unique([...word.situation_tags, value === "room" ? "room" : "daily_talk"]), affordances: unique([...word.affordances, `where:${value}`]), source_question_ids: unique([...word.source_question_ids, "ask_category_detail"]) })
  };
}

function feelingDetail(): CategoryDetail {
  return {
    prompt: "その気持ちは、どんな色に近い？",
    options: [
      { value: "warm", label: "あたたかい" },
      { value: "lonely", label: "さみしい" },
      { value: "heart", label: "どきどき" },
      { value: "quiet", label: "しずか" }
    ],
    getValue: (word) => word.relation_tags[0] ?? "warm",
    getLabel: (word) => ({ warm: "あたたかい", lonely: "さみしい", heart: "どきどき", quiet: "しずか" })[word.relation_tags[0] ?? "warm"] ?? "まだ不明",
    apply: (word, value) => ({ ...word, relation_tags: [value], notes: `色メモ: ${value}`, source_question_ids: unique([...word.source_question_ids, "ask_category_detail"]) })
  };
}

function unknownDetail(): CategoryDetail {
  return {
    prompt: "まだ仮置きにする？",
    options: [
      { value: "temporary", label: "仮置き" },
      { value: "review", label: "あとで直す" }
    ],
    getValue: (word) => word.relation_tags[0] ?? "temporary",
    getLabel: (word) => word.relation_tags[0] === "review" ? "あとで直す" : "仮置き",
    apply: (word, value) => ({ ...word, relation_tags: [value], confidence: 0.45, ambiguity_score: 0.7, source_question_ids: unique([...word.source_question_ids, "ask_category_detail"]) })
  };
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function getMeaningMemo(word: WordFrame): string {
  if (word.category === "food") {
    if (word.user_stance === "like") return "好きな食べ物";
    if (word.user_stance === "dislike") return "苦手な食べ物";
    if (word.emotion_tags.includes("curious")) return "気になる食べ物";
  }
  if (word.category === "place") return relationLabel(word.relation_tags[0], { want_to_go: "行きたい場所", calm: "落ち着く場所", event: "にぎやかな場所" });
  if (word.category === "object") return relationLabel(word.relation_tags[0], { room: "部屋にありそう", outside: "外にありそう", belonging: "持ちもの" });
  if (word.category === "person") return relationLabel(word.relation_tags[0], { near: "近い人", famous: "有名な人" });
  if (word.category === "feeling") return relationLabel(word.relation_tags[0], { warm: "あたたかい感じ", lonely: "さみしい感じ", heart: "どきどきする感じ", quiet: "しずかな感じ" });
  if (word.category === "action") return word.emotion_tags[0] ? `${emotionLabels[word.emotion_tags[0]]}動き` : "動きの言葉";
  if (word.category === "unknown") return word.relation_tags[0] === "review" ? "あとで直す" : "仮置き";
  return relationLabel(word.relation_tags[0], { daily: "日常の言葉", important: "大事な言葉" });
}

function relationLabel(value: string | undefined, labels: Record<string, string>): string {
  return value ? labels[value] ?? "まだ不明" : "まだ不明";
}
