import { useMemo, useState } from "react";
import type { Concept, ConceptCategory } from "../../domain/model/concept";
import { categoryLabels } from "../../domain/learning/categoryRouting";
import { conceptCategories } from "../../domain/model/concept";
import { grammarForCategory } from "../../domain/learning/conceptFactory";
import { db } from "../../infrastructure/db/database";
import { ScreenHeader } from "../../ui/components/ScreenHeader";

export function WordbookScreen({ concepts, onBack, onChanged }: { concepts: Concept[]; onBack: () => void; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const userConcepts = useMemo(
    () => concepts.filter((concept) => concept.source === "user" && concept.surface.includes(query)).sort((a, b) => b.learnedAt - a.learnedAt),
    [concepts, query]
  );

  async function patch(concept: Concept, changes: Partial<Concept>, now: number) {
    await db.concepts.put({ ...concept, ...changes, lastReviewedAt: now, reviewCount: concept.reviewCount + 1 });
    await onChanged();
  }

  return (
    <main className="feature-screen">
      <ScreenHeader title="アグリの単語帳" onBack={onBack} aside={<span>{userConcepts.length}こ</span>} />
      <section className="paper-panel">
        <label>言葉を探す<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </section>
      <div className="concept-list">
        {userConcepts.map((concept) => (
          <article className="concept-row" key={concept.id}>
            <header><strong>{concept.surface}</strong><span>{concept.active ? "会話で使う" : "お休み中"}</span></header>
            <label>読み<input value={concept.reading ?? ""} maxLength={24} onChange={(event) => void patch(concept, { reading: event.target.value }, Date.now())} /></label>
            <label>種類<select value={concept.userCategory} onChange={(event) => { const category = event.target.value as ConceptCategory; void patch(concept, { userCategory: category, grammar: grammarForCategory(category) }, Date.now()); }}>{conceptCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label>
            <label>好き度<select value={concept.preference ?? 0} onChange={(event) => void patch(concept, { preference: Number(event.target.value) as -2 | -1 | 0 | 1 | 2 }, Date.now())}><option value={2}>大好き</option><option value={1}>好き</option><option value={0}>ふつう</option><option value={-1}>少し苦手</option><option value={-2}>苦手</option></select></label>
            <button type="button" onClick={() => void patch(concept, { active: !concept.active }, Date.now())}>{concept.active ? "会話で使わない" : "会話へ戻す"}</button>
          </article>
        ))}
        {userConcepts.length === 0 ? <p className="empty-note">まだ教えた言葉はありません。</p> : null}
      </div>
    </main>
  );
}
