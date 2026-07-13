import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, MessageCircle, Newspaper } from "lucide-react";
import type { CharacterState } from "../../domain/model/character";
import type { Concept } from "../../domain/model/concept";
import type { MemoryEvent } from "../../domain/model/memory";
import type { ArticleDigest, NewsItem } from "../../domain/model/news";
import type { GameSettings } from "../../domain/model/player";
import type { ConceptRelation } from "../../domain/model/relation";
import { buildNewsConversationPlan } from "../../domain/news/newsExplanation";
import { playGameSound } from "../../infrastructure/audio/gameAudio";
import { db } from "../../infrastructure/db/database";
import { buildFeedDigest, fetchArticleDigest } from "../../infrastructure/news/articleDigestService";
import { DialogueBox } from "../../ui/components/DialogueBox";
import { ScreenHeader } from "../../ui/components/ScreenHeader";

export function NewsScreen({ items, concepts, character, relations, memories, settings, onBack, onOpenSettings, onChanged }: {
  items: NewsItem[];
  concepts: Concept[];
  character?: CharacterState | undefined;
  relations?: ConceptRelation[] | undefined;
  memories?: MemoryEvent[] | undefined;
  settings: GameSettings;
  onBack: () => void;
  onOpenSettings: () => void;
  onChanged: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [digest, setDigest] = useState<ArticleDigest | null>(null);
  const [readingArticle, setReadingArticle] = useState(false);
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const selected = items.find((item) => item.id === selectedId);
  const plan = useMemo(() => selected && digest
    ? buildNewsConversationPlan(selected, digest, concepts, { character, relations, memories })
    : null, [character, concepts, digest, memories, relations, selected]);
  const pages = plan?.pages ?? [];

  useEffect(() => () => requestRef.current?.controller.abort(), []);

  async function discuss(item: NewsItem, now: number) {
    requestRef.current?.controller.abort();
    const request = { id: (requestRef.current?.id ?? 0) + 1, controller: new AbortController() };
    requestRef.current = request;
    setSelectedId(item.id);
    setPageIndex(0);
    setDigest(buildFeedDigest(item, now));
    setReadingArticle(true);
    playGameSound("talk", settings);
    await db.newsItems.update(item.id, { discussedAt: now });
    void onChanged();
    try {
      const nextDigest = await fetchArticleDigest(item, {
        useArticleHelper: settings.newsUseArticleHelper,
        signal: request.controller.signal,
        now
      });
      if (requestRef.current?.id !== request.id || request.controller.signal.aborted) return;
      setDigest(nextDigest);
      setPageIndex(0);
    } catch {
      // A newer selection or an explicit cancellation keeps the compact RSS digest.
    } finally {
      if (requestRef.current?.id === request.id) setReadingArticle(false);
    }
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
            text={pages[pageIndex]?.text ?? "見出しを読み直しています。"}
            textSpeed={settings.textSpeed}
            emotion={pages[pageIndex]?.emotion ?? "curious"}
            hasNext={pageIndex < pages.length - 1}
            onNext={nextPage}
          />
          <p className="article-read-status" role="status">{readingArticle ? "記事を直接読めるか確認しています…" : `確認範囲: ${contentLevelLabel(plan?.contentLevel ?? "headline_only")}`}</p>
          {plan ? (
            <details className="news-grounding-debug">
              <summary>会話の根拠</summary>
              <ol>{plan.pages.map((page) => <li key={page.id}>{groundingLabel(page.source)}{page.evidenceIds.length > 0 ? ` (${page.evidenceIds.length}件)` : ""}</li>)}</ol>
            </details>
          ) : null}
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

function contentLevelLabel(level: "headline_only" | "feed_summary" | "feed_content" | "article_extract") {
  return {
    headline_only: "見出しのみ",
    feed_summary: "RSSの短い説明まで",
    feed_content: "RSS内の本文まで",
    article_extract: "取得できた記事本文の一部まで"
  }[level];
}

function groundingLabel(source: NonNullable<ReturnType<typeof buildNewsConversationPlan>["pages"]>[number]["source"]) {
  return {
    headline: "見出し",
    feed_summary: "RSSの短い説明",
    feed_content: "RSS内の本文",
    article: "記事本文",
    memory: "教えてもらった記憶",
    inference: "アグリの整理",
    aguri_opinion: "アグリの感想",
    imagination: "アグリの想像",
    unknown: "まだ不明なこと"
  }[source];
}
