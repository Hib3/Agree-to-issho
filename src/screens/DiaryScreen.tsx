import type { DiaryEntry } from "../types/domain";
import type { WordFrame } from "../types/domain";
import { sanitizeGameText } from "../utils/sanitizeGameText";

type DiaryScreenProps = {
  entries: DiaryEntry[];
  words: WordFrame[];
  onGenerate: () => void;
  onOpenWordbook: () => void;
  onBack: () => void;
};

export function DiaryScreen({ entries, words, onGenerate, onOpenWordbook, onBack }: DiaryScreenProps) {
  const sorted = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  const wordMap = new Map(words.map((word) => [word.id, word]));
  return (
    <main className="screen">
      <div className="topbar">
        <h1>日記</h1>
        <div className="topbar-actions">
          <button type="button" onClick={onGenerate}>今日を書く</button>
          <button type="button" onClick={onBack}>戻る</button>
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="empty">まだ日記はありません。</p>
      ) : (
        <div className="diary-list">
          {sorted.map((entry) => (
            <article className="panel" key={entry.id}>
              <p className="eyebrow">{entry.entry_date}</p>
              <h2>{entry.title}</h2>
              <p>{sanitizeGameText(entry.body)}</p>
              {entry.used_word_ids.length > 0 && (
                <div className="diary-word-chips" aria-label="日記に出た言葉">
                  {entry.used_word_ids.map((id) => {
                    const word = wordMap.get(id);
                    if (!word) return null;
                    return <button type="button" key={id} onClick={onOpenWordbook}>{word.surface}</button>;
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
