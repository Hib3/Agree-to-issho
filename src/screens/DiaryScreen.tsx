import type { DiaryEntry } from "../types/domain";

type DiaryScreenProps = {
  entries: DiaryEntry[];
  onGenerate: () => void;
  onBack: () => void;
};

export function DiaryScreen({ entries, onGenerate, onBack }: DiaryScreenProps) {
  const sorted = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
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
              <p>{entry.body}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
