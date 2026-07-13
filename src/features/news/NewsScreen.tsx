import { useMemo, useState } from "react";
import { ExternalLink, MessageCircle, Newspaper } from "lucide-react";
import type { Concept } from "../../domain/model/concept";
import type { NewsItem } from "../../domain/model/news";
import type { GameSettings } from "../../domain/model/player";
import { buildNewsExplanation } from "../../domain/news/newsExplanation";
import { playGameSound } from "../../infrastructure/audio/gameAudio";
import { db } from "../../infrastructure/db/database";
import { DialogueBox } from "../../ui/components/DialogueBox";
import { ScreenHeader } from "../../ui/components/ScreenHeader";

export function NewsScreen({ items, concepts, settings, onBack, onOpenSettings, onChanged }: {
  items: NewsItem[];
  concepts: Concept[];
  settings: GameSettings;
  onBack: () => void;
  onOpenSettings: () => void;
  onChanged: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const selected = items.find((item) => item.id === selectedId);
  const pages = useMemo(() => selected ? buildNewsExplanation(selected, concepts) : [], [concepts, selected]);

  async function discuss(item: NewsItem, now: number) {
    setSelectedId(item.id);
    setPageIndex(0);
    playGameSound("talk", settings);
    await db.newsItems.put({ ...item, discussedAt: now });
    await onChanged();
  }

  function nextPage() {
    if (pageIndex >= pages.length - 1) return;
    playGameSound("page", settings);
    setPageIndex((index) => index + 1);
  }

  return (
    <main className="feature-screen news-screen">
      <ScreenHeader title="アグリのニュース" onBack={onBack} />
      <section className="news-intro paper-panel">
        <p>登録したRSSの見出しと短い説明だけを読みます。詳しい内容や真偽は、元の記事で確かめてください。</p>
      </section>
      {selected ? (
        <section className="news-dialogue paper-panel">
          <DialogueBox
            speaker="アグリちゃん"
            text={pages[pageIndex] ?? "ニュースを読み直していますっ。"}
            textSpeed={settings.textSpeed}
            emotion={pageIndex === 0 ? "excited" : "curious"}
            hasNext={pageIndex < pages.length - 1}
            onNext={nextPage}
          />
          <a className="source-link" href={selected.url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />元の記事を開く</a>
        </section>
      ) : null}
      <section className="news-list paper-panel" aria-label="保存したニュース">
        <h2>新しい見出し</h2>
        {items.length === 0 ? (
          <div className="news-empty">
            <Newspaper aria-hidden="true" />
            <strong>まだ見出しを受け取っていません</strong>
            <p>読みたいRSSを登録し、「今すぐ更新」を押してください。</p>
            <button className="quiet" type="button" onClick={onOpenSettings}>RSSを設定する</button>
          </div>
        ) : (
          <ul>
            {items.slice(0, 30).map((item) => (
              <li key={item.id} className={item.id === selectedId ? "selected" : ""}>
                <div><span>{item.sourceName}</span><time dateTime={new Date(item.publishedAt).toISOString()}>{new Date(item.publishedAt).toLocaleString("ja-JP")}</time></div>
                <strong>{item.title}</strong>
                <button className="quiet" type="button" onClick={() => void discuss(item, Date.now())}><MessageCircle aria-hidden="true" />アグリに話してもらう</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
