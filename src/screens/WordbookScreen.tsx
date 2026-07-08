import { FormEvent, useState } from "react";
import type { WordFrame } from "../types/domain";

type WordbookScreenProps = {
  words: WordFrame[];
  onBack: () => void;
  onPatchWord: (wordId: string, patch: Partial<WordFrame>) => void;
};

export function WordbookScreen({ words, onBack, onPatchWord }: WordbookScreenProps) {
  const sorted = [...words].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return (
    <main className="screen">
      <div className="topbar">
        <h1>単語帳</h1>
        <button type="button" onClick={onBack}>戻る</button>
      </div>
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
  const [blocked, setBlocked] = useState(word.is_blocked);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onPatchWord(word.id, { notes, is_blocked: blocked });
  }

  return (
    <article className="word-card">
      <h2>{word.surface}</h2>
      <dl>
        <div><dt>カテゴリ</dt><dd>{word.category}</dd></div>
        <div><dt>感情</dt><dd>{word.emotion_tags.join(", ") || "unknown"}</dd></div>
        <div><dt>場面</dt><dd>{word.situation_tags.join(", ") || "unknown"}</dd></div>
        <div><dt>わかった度</dt><dd>{Math.round(word.confidence * 100)}%</dd></div>
        <div><dt>使用回数</dt><dd>{word.use_count}</dd></div>
      </dl>
      <form className="form-stack inline-edit" onSubmit={handleSubmit}>
        <label>
          メモ
          <input value={notes} maxLength={120} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={blocked} onChange={(event) => setBlocked(event.target.checked)} />
          通常会話に出さない
        </label>
        <button type="submit">更新</button>
      </form>
    </article>
  );
}
