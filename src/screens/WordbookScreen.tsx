import { FormEvent, useState } from "react";
import { getCategoryLabel, getConfidenceLabel, getDriftLevelLabel, getEmotionLabel, getMemoryStrengthLabel, getSituationLabel } from "../game/word/labels";
import { applyDetailedReview, reviewCategoryOptions, reviewEmotionOptions, reviewSituationOptions } from "../game/word/review";
import { getShiritoriCandidates } from "../game/word/shiritori";
import { applyReview } from "../game/word/wordMemory";
import type { EmotionTag, SituationTag, WordCategory, WordFrame } from "../types/domain";

type WordbookScreenProps = {
  words: WordFrame[];
  onBack: () => void;
  onPatchWord: (wordId: string, patch: Partial<WordFrame>) => void;
};

export function WordbookScreen({ words, onBack, onPatchWord }: WordbookScreenProps) {
  const sorted = [...words].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const shiritori = words.length >= 10 ? getShiritoriCandidates(words, 4) : [];
  return (
    <main className="screen">
      <div className="topbar">
        <h1>単語帳</h1>
        <button type="button" onClick={onBack}>戻る</button>
      </div>
      {shiritori.length > 0 && (
        <section className="panel word-link-panel" aria-label="しりとり候補">
          <h2>しりとり候補</h2>
          <p>読みがつながりそうな言葉です。まだ遊びの入口だけです。</p>
          <div className="word-link-list">
            {shiritori.map((item) => (
              <span key={item.from.id}>{item.from.surface} → {item.next.map((word) => word.surface).join("、")}</span>
            ))}
          </div>
        </section>
      )}
      {sorted.length === 0 ? (
        <p className="empty">まだ言葉はありません。</p>
      ) : (
        <div className="word-list">
          {sorted.map((word) => (
            <WordCard key={word.id} word={word} onPatchWord={onPatchWord} />
          ))}
        </div>
      )}
    </main>
  );
}

function WordCard({ word, onPatchWord }: { word: WordFrame; onPatchWord: (wordId: string, patch: Partial<WordFrame>) => void }) {
  const [notes, setNotes] = useState(word.notes);
  const [reading, setReading] = useState(word.reading);
  const [category, setCategory] = useState<WordCategory>(word.category);
  const [emotion, setEmotion] = useState<EmotionTag>(word.emotion_tags[0] ?? "neutral");
  const [situation, setSituation] = useState<SituationTag>(word.situation_tags[0] ?? "daily_talk");
  const [blocked, setBlocked] = useState(word.is_blocked);
  const [sensitive, setSensitive] = useState(word.is_sensitive);
  const [forgotten, setForgotten] = useState(Boolean(word.forgotten_at));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onPatchWord(word.id, {
      notes,
      reading,
      is_blocked: blocked,
      is_sensitive: sensitive,
      forgotten_at: forgotten ? word.forgotten_at ?? new Date().toISOString() : undefined
    });
  }

  function handleReview() {
    onPatchWord(word.id, applyReview(word));
  }

  function handleDetailedReview() {
    onPatchWord(word.id, applyDetailedReview(word, { category, emotion, situation, reading, notes }));
  }

  return (
    <article className="word-card">
      <h2>{word.surface}</h2>
      <dl>
        <div><dt>カテゴリ</dt><dd>{getCategoryLabel(word.category)}</dd></div>
        <div><dt>感情</dt><dd>{word.emotion_tags.map(getEmotionLabel).join("、") || "未設定"}</dd></div>
        <div><dt>場面</dt><dd>{word.situation_tags.map(getSituationLabel).join("、") || "未設定"}</dd></div>
        <div><dt>わかった度</dt><dd>{getConfidenceLabel(word.confidence)}</dd></div>
        <div><dt>記憶</dt><dd>{getMemoryStrengthLabel(word.memory_strength)}</dd></div>
        <div><dt>ズレ</dt><dd>{getDriftLevelLabel(word.drift_level)}</dd></div>
        <div><dt>復習</dt><dd>{word.review_count}回</dd></div>
        <div><dt>使用回数</dt><dd>{word.use_count}</dd></div>
      </dl>
      <form className="form-stack inline-edit" onSubmit={handleSubmit}>
        <label>
          読み
          <input value={reading} maxLength={24} onChange={(event) => setReading(event.target.value)} />
        </label>
        <div className="review-edit-grid">
          <label>
            種類
            <select value={category} onChange={(event) => setCategory(event.target.value as WordCategory)}>
              {reviewCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            気持ち
            <select value={emotion} onChange={(event) => setEmotion(event.target.value as EmotionTag)}>
              {reviewEmotionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            場面
            <select value={situation} onChange={(event) => setSituation(event.target.value as SituationTag)}>
              {reviewSituationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <label>
          メモ
          <input value={notes} maxLength={120} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={blocked} onChange={(event) => setBlocked(event.target.checked)} />
          通常会話に出さない
        </label>
        <label className="check-row">
          <input type="checkbox" checked={sensitive} onChange={(event) => setSensitive(event.target.checked)} />
          慎重に扱う
        </label>
        <label className="check-row">
          <input type="checkbox" checked={forgotten} onChange={(event) => setForgotten(event.target.checked)} />
          普段の会話から外す
        </label>
        <button type="button" onClick={handleDetailedReview}>選んだ内容で復習する</button>
        <button type="button" onClick={handleReview}>この言葉を復習した</button>
        <button type="submit">更新</button>
      </form>
    </article>
  );
}
