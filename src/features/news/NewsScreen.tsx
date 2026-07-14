import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, MessageCircle, Newspaper, RefreshCw, SlidersHorizontal } from "lucide-react";
import type { NewsDiscussionPreparation, NewsItem } from "../../domain/model/news";
import type { GameSettings } from "../../domain/model/player";
import { playGameSound } from "../../infrastructure/audio/gameAudio";
import { db } from "../../infrastructure/db/database";
import { buildFeedDigest, fetchArticleDigest } from "../../infrastructure/news/articleDigestService";
import { startNewsConversation } from "../conversation/conversationService";
import { ScreenHeader } from "../../ui/components/ScreenHeader";

export const NEWS_PREPARATION_STORAGE_KEY = "aguri-news-preparation-v1";

export function NewsScreen({
  items,
  settings,
  onBack,
  onOpenSettings,
  onRefresh,
  onChanged,
  onConversationStarted
}: {
  items: NewsItem[];
  settings: GameSettings;
  onBack: () => void;
  onOpenSettings: () => void;
  onRefresh: () => Promise<void>;
  onChanged: () => Promise<void>;
  onConversationStarted: () => void;
}) {
  const [selectedFeed, setSelectedFeed] = useState("all");
  const [preparation, setPreparation] = useState<NewsDiscussionPreparation>(restorePreparation);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const recoveredRef = useRef(false);
  const feeds = useMemo(
    () => [...new Map(items.map((item) => [item.feedId, item.sourceName])).entries()],
    [items]
  );
  const visibleItems = useMemo(
    () => items.filter((item) => selectedFeed === "all" || item.feedId === selectedFeed).slice(0, 40),
    [items, selectedFeed]
  );
  const unreadCount = items.filter(
    (item) => item.discussionState !== "discussed" && !item.discussedAt
  ).length;

  useEffect(() => () => requestRef.current?.controller.abort(), []);

  useEffect(() => {
    if (preparation.status === "idle" || preparation.status === "ready") {
      sessionStorage.removeItem(NEWS_PREPARATION_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(NEWS_PREPARATION_STORAGE_KEY, JSON.stringify(preparation));
  }, [preparation]);

  useEffect(() => {
    if (recoveredRef.current) return;
    recoveredRef.current = true;
    if (preparation.status !== "reading_feed" && preparation.status !== "reading_article") return;
    const timer = window.setTimeout(() => {
      const item = items.find((entry) => entry.id === preparation.newsItemId);
      if (item) void prepareArticle(item);
      else setPreparation({ status: "idle" });
    }, 0);
    return () => window.clearTimeout(timer);
    // Only the preparation restored at mount may restart an interrupted request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function prepareArticle(item: NewsItem) {
    requestRef.current?.controller.abort();
    const request = { id: (requestRef.current?.id ?? 0) + 1, controller: new AbortController() };
    requestRef.current = request;
    setMessage("");
    setPreparation({ status: "reading_feed", newsItemId: item.id });
    playGameSound("talk", settings);
    const feedDigest = buildFeedDigest(item, Date.now());
    if (feedDigest.contentLevel !== "feed_content") {
      setPreparation({ status: "reading_article", newsItemId: item.id });
    }
    try {
      const result = await fetchArticleDigest(item, {
        useArticleHelper: settings.newsUseArticleHelper,
        signal: request.controller.signal,
        now: Date.now()
      });
      if (requestRef.current?.id !== request.id || request.controller.signal.aborted) return;
      debugFetchTrace(result.trace);
      if (result.needsHelperConsent) {
        setPreparation({
          status: "awaiting_helper_consent",
          newsItemId: item.id,
          directFailureReason:
            result.directFailureReason ?? "ブラウザから記事本文を直接取得できませんでした。",
          fallbackDigest: result.digest,
          trace: result.trace
        });
        return;
      }
      if (helperFailed(result.trace) && result.digest.contentLevel !== "article_extract") {
        setPreparation({
          status: "failed",
          newsItemId: item.id,
          fallbackDigest: result.digest,
          reason: result.directFailureReason ?? "取得補助でも本文を確認できませんでした。",
          trace: result.trace
        });
        return;
      }
      await beginConversation(item, result.digest, result.trace);
    } catch (error) {
      if (request.controller.signal.aborted) return;
      const fallbackDigest = buildFeedDigest(item, Date.now());
      setPreparation({
        status: "failed",
        newsItemId: item.id,
        fallbackDigest,
        reason: friendlyError(error),
        trace: {
          articleUrl: item.url,
          startedAt: Date.now(),
          attempts: [],
          finalContentLevel: fallbackDigest.contentLevel
        }
      });
    }
  }

  async function allowArticleHelper(persist: boolean) {
    if (preparation.status !== "awaiting_helper_consent") return;
    const item = items.find((entry) => entry.id === preparation.newsItemId);
    if (!item) return;
    const request = { id: (requestRef.current?.id ?? 0) + 1, controller: new AbortController() };
    requestRef.current?.controller.abort();
    requestRef.current = request;
    const previousTrace = preparation.trace;
    setPreparation({ status: "reading_article", newsItemId: item.id });
    if (persist) {
      await db.settings.put({ ...settings, newsUseArticleHelper: true, updatedAt: Date.now() });
      await onChanged();
    }
    try {
      const result = await fetchArticleDigest(item, {
        useArticleHelper: true,
        attemptDirect: false,
        previousTrace,
        signal: request.controller.signal,
        now: Date.now()
      });
      if (requestRef.current?.id !== request.id || request.controller.signal.aborted) return;
      debugFetchTrace(result.trace);
      if (helperFailed(result.trace) && result.digest.contentLevel !== "article_extract") {
        setPreparation({
          status: "failed",
          newsItemId: item.id,
          fallbackDigest: result.digest,
          reason: result.directFailureReason ?? "取得補助でも記事本文を確認できませんでした。",
          trace: result.trace
        });
        return;
      }
      await beginConversation(item, result.digest, result.trace);
    } catch (error) {
      if (request.controller.signal.aborted) return;
      setPreparation({
        status: "failed",
        newsItemId: item.id,
        fallbackDigest: buildFeedDigest(item, Date.now()),
        reason: friendlyError(error),
        trace: previousTrace
      });
    }
  }

  async function beginConversation(
    item: NewsItem,
    digest: Extract<NewsDiscussionPreparation, { status: "ready" }>["digest"],
    trace: Extract<NewsDiscussionPreparation, { status: "ready" }>["trace"]
  ) {
    const previousDiscussionState = item.discussionState ?? (item.discussedAt ? "discussed" : "unread");
    setPreparation({ status: "ready", newsItemId: item.id, digest, trace });
    await db.newsItems.update(item.id, { discussionState: "prepared" });
    try {
      await startNewsConversation({ item, digest, fetchTrace: trace, now: Date.now() });
      sessionStorage.removeItem(NEWS_PREPARATION_STORAGE_KEY);
      await onChanged();
      onConversationStarted();
    } catch (error) {
      await db.newsItems.update(item.id, { discussionState: previousDiscussionState });
      setPreparation({ status: "idle" });
      setMessage(friendlyError(error));
      await onChanged();
    }
  }

  async function continueWithoutHelper() {
    if (preparation.status === "awaiting_helper_consent") {
      const item = items.find((entry) => entry.id === preparation.newsItemId);
      if (item) await beginConversation(item, preparation.fallbackDigest, preparation.trace);
      return;
    }
    if (preparation.status === "failed") {
      const item = items.find((entry) => entry.id === preparation.newsItemId);
      if (item) await beginConversation(item, preparation.fallbackDigest, preparation.trace);
    }
  }

  async function updateNews() {
    if (refreshing) return;
    setRefreshing(true);
    setMessage("");
    try {
      await onRefresh();
      setMessage("ニュースを更新しました。");
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setRefreshing(false);
    }
  }

  function cancelPreparation() {
    requestRef.current?.controller.abort();
    requestRef.current = null;
    setPreparation({ status: "idle" });
    setMessage("");
  }

  const selectedItem =
    preparation.status === "idle" ? undefined : items.find((item) => item.id === preparation.newsItemId);

  return (
    <main className="feature-screen news-screen">
      <ScreenHeader
        title="ニュース"
        onBack={onBack}
        aside={<span className="news-unread-count">未読 {unreadCount}件</span>}
      />
      <section className="news-toolbar paper-panel" aria-label="ニュースの操作">
        <button className="quiet" type="button" disabled={refreshing} onClick={() => void updateNews()}>
          <RefreshCw aria-hidden="true" />
          {refreshing ? "更新中…" : "更新"}
        </button>
        <button className="quiet" type="button" onClick={onOpenSettings}>
          <SlidersHorizontal aria-hidden="true" />
          RSS設定
        </button>
        <label>
          出典
          <select value={selectedFeed} onChange={(event) => setSelectedFeed(event.target.value)}>
            <option value="all">すべて</option>
            {feeds.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {preparation.status !== "idle" ? (
        <section className="news-preparation paper-panel" aria-live="polite">
          <h2>{preparationTitle(preparation)}</h2>
          {selectedItem ? <strong>{selectedItem.title}</strong> : null}
          <p>{preparationMessage(preparation)}</p>

          {preparation.status === "awaiting_helper_consent" ? (
            <div className="helper-consent-panel">
              <p>
                記事のURLを取得補助サービスへ送ると、アグリが本文の一部を読める可能性があります。
                同意するまでURLは送りません。
              </p>
              <small>直接取得の結果: {preparation.directFailureReason}</small>
              <div className="consent-actions">
                <button className="primary" type="button" onClick={() => void allowArticleHelper(false)}>
                  今回だけ許可
                </button>
                <button className="quiet" type="button" onClick={() => void allowArticleHelper(true)}>
                  今後も許可
                </button>
                <button className="quiet" type="button" onClick={() => void continueWithoutHelper()}>
                  許可しない（取得補助なしで話す）
                </button>
                {selectedItem ? (
                  <a className="source-link" href={selectedItem.url} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" />
                    元記事を開く
                  </a>
                ) : null}
                <button className="text-button" type="button" onClick={cancelPreparation}>
                  キャンセル
                </button>
              </div>
            </div>
          ) : null}

          {preparation.status === "failed" ? (
            <div className="news-fallback-actions">
              <small>{preparation.reason}</small>
              <button className="primary" type="button" onClick={() => void continueWithoutHelper()}>
                取得できた範囲で話す
              </button>
              {selectedItem ? (
                <a className="source-link" href={selectedItem.url} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" />
                  元記事を開く
                </a>
              ) : null}
              <button className="text-button" type="button" onClick={cancelPreparation}>
                キャンセル
              </button>
            </div>
          ) : null}

          {import.meta.env.DEV && "trace" in preparation ? (
            <details className="news-fetch-debug">
              <summary>取得記録</summary>
              <pre>{JSON.stringify(preparation.trace, null, 2)}</pre>
            </details>
          ) : null}
        </section>
      ) : null}

      {message ? <p className="inline-notice">{message}</p> : null}

      <section className="news-list paper-panel" aria-label="保存したニュース">
        <h2>届いた記事</h2>
        {visibleItems.length === 0 ? (
          <div className="news-empty">
            <Newspaper aria-hidden="true" />
            <strong>まだニュースがありません</strong>
            <p>RSSを登録して「更新」を押してください。</p>
            <button className="quiet" type="button" onClick={onOpenSettings}>
              RSSを設定する
            </button>
          </div>
        ) : (
          <ul>
            {visibleItems.map((item) => {
              const level = buildFeedDigest(item, item.fetchedAt).contentLevel;
              const state = item.discussionState ?? (item.discussedAt ? "discussed" : "unread");
              return (
                <li key={item.id} className={`news-item state-${state}`}>
                  <div className="news-item-meta">
                    <span>{item.sourceName}</span>
                    <time dateTime={new Date(item.publishedAt).toISOString()}>
                      {new Date(item.publishedAt).toLocaleString("ja-JP")}
                    </time>
                    <span>{stateLabel(state)}</span>
                  </div>
                  <strong>{item.title}</strong>
                  {item.summary ? <p>{item.summary.slice(0, 140)}</p> : null}
                  <small>RSSで確認済み: {contentLevelLabel(level)}</small>
                  <div className="news-item-actions">
                    <button className="primary" type="button" onClick={() => void prepareArticle(item)}>
                      <MessageCircle aria-hidden="true" />
                      アグリと話す
                    </button>
                    <a className="source-link" href={item.url} target="_blank" rel="noreferrer">
                      <ExternalLink aria-hidden="true" />
                      元記事を開く
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function restorePreparation(): NewsDiscussionPreparation {
  try {
    const raw = sessionStorage.getItem(NEWS_PREPARATION_STORAGE_KEY);
    if (!raw) return { status: "idle" };
    const parsed = JSON.parse(raw) as NewsDiscussionPreparation;
    if (!parsed || typeof parsed !== "object" || !("status" in parsed)) return { status: "idle" };
    return parsed;
  } catch {
    return { status: "idle" };
  }
}

function preparationTitle(preparation: NewsDiscussionPreparation) {
  if (preparation.status === "reading_feed" || preparation.status === "reading_article")
    return "アグリが記事を読んでいます…";
  if (preparation.status === "awaiting_helper_consent") return "この記事は直接開けませんでした";
  if (preparation.status === "failed") return "記事本文を確認できませんでした";
  if (preparation.status === "ready") return "記事の準備ができました";
  return "記事を準備します";
}

function preparationMessage(preparation: NewsDiscussionPreparation) {
  if (preparation.status === "reading_feed") return "RSSに含まれる説明と本文を確認しています。";
  if (preparation.status === "reading_article") return "記事本文をブラウザから開けるか試しています。";
  if (preparation.status === "awaiting_helper_consent")
    return "取得補助を使うか、読めた範囲だけで話すか選んでください。";
  if (preparation.status === "failed") return "見出しやRSSの説明は残っています。話す範囲を選べます。";
  if (preparation.status === "ready") return "部屋へ戻って会話を始めます。";
  return "";
}

function contentLevelLabel(level: "headline_only" | "feed_summary" | "feed_content" | "article_extract") {
  return {
    headline_only: "見出しのみ",
    feed_summary: "短い説明まで",
    feed_content: "RSS内の本文まで",
    article_extract: "記事本文の一部まで"
  }[level];
}

function stateLabel(state: NonNullable<NewsItem["discussionState"]>) {
  return {
    unread: "未読",
    prepared: "準備済み",
    discussing: "会話中",
    discussed: "会話済み",
    dismissed: "保留"
  }[state];
}

function helperFailed(trace: Extract<NewsDiscussionPreparation, { status: "ready" }>["trace"]) {
  const attempt = [...trace.attempts].reverse().find((entry) => entry.method === "reader_helper");
  return Boolean(attempt && attempt.result !== "success" && attempt.result !== "disabled");
}

function friendlyError(error: unknown) {
  return error instanceof Error ? error.message : "記事の準備中に問題が起きました。";
}

function debugFetchTrace(trace: Extract<NewsDiscussionPreparation, { status: "ready" }>["trace"]) {
  if (import.meta.env.DEV) console.debug("[news article fetch]", trace);
}
