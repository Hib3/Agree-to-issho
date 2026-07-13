import type { Concept } from "../../domain/model/concept";
import type { DialogueHistoryEntry } from "../../domain/model/conversation";
import type { DiaryEntry, MemoryEvent } from "../../domain/model/memory";
import { generateDiary } from "../../domain/diary/diaryGenerator";
import { db } from "../../infrastructure/db/database";
import { ScreenHeader } from "../../ui/components/ScreenHeader";

export function DiaryScreen({
  concepts,
  memories,
  dialogue,
  diaries,
  onBack,
  onChanged
}: {
  concepts: Concept[];
  memories: MemoryEvent[];
  dialogue: DialogueHistoryEntry[];
  diaries: DiaryEntry[];
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  async function createToday() {
    const now = Date.now();
    const date = new Date(now).toISOString().slice(0, 10);
    if (diaries.some((diary) => diary.date === date)) return;
    await db.diaries.put(generateDiary({ date, concepts, memories, dialogue, now }));
    await onChanged();
  }
  return (
    <main className="feature-screen diary-screen">
      <ScreenHeader title="アグリの日記" onBack={onBack} />
      <button className="primary page-action" type="button" onClick={() => void createToday()}>
        今日の日記を開く
      </button>
      <div className="diary-list">
        {[...diaries].reverse().map((diary) => (
          <article key={diary.id} className="diary-page">
            <time>{diary.date}</time>
            <h2>{diary.title}</h2>
            <p>{diary.body}</p>
          </article>
        ))}
        {diaries.length === 0 ? <p className="empty-note">日記は、今日の会話をしてから開けます。</p> : null}
      </div>
    </main>
  );
}
