import { useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, Trash2, Volume2 } from "lucide-react";
import type { NewsFeedCandidate } from "../../domain/model/news";
import type { GameSettings } from "../../domain/model/player";
import { playGameSound } from "../../infrastructure/audio/gameAudio";
import { db } from "../../infrastructure/db/database";
import { createNewsFeedFromCandidate, discoverNewsFeeds, refreshNews, removeNewsFeed } from "../../infrastructure/news/newsService";
import { ScreenHeader } from "../../ui/components/ScreenHeader";
import { StorageStatus } from "../../ui/components/StorageStatus";

export function SettingsScreen({ settings: persistedSettings, onBack, onChanged }: {
  settings: GameSettings;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const [draftSettings, setDraftSettings] = useState<GameSettings | null>(null);
  const settings = draftSettings ?? persistedSettings;
  const [feedUrl, setFeedUrl] = useState("");
  const [newsStatus, setNewsStatus] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [feedCandidates, setFeedCandidates] = useState<NewsFeedCandidate[]>([]);
  const operationRef = useRef<{ id: number; controller: AbortController } | null>(null);

  useEffect(() => () => operationRef.current?.controller.abort(), []);

  async function patch(changes: Partial<GameSettings>) {
    const latest = await db.settings.get("local") ?? settings;
    const next = { ...latest, ...changes, updatedAt: Date.now() };
    setDraftSettings(next);
    try {
      await db.settings.put(next);
      await onChanged();
      return next;
    } finally {
      setDraftSettings((current) => current === next ? null : current);
    }
  }

  function beginOperation() {
    operationRef.current?.controller.abort();
    const operation = { id: (operationRef.current?.id ?? 0) + 1, controller: new AbortController() };
    operationRef.current = operation;
    return operation;
  }

  function isCurrentOperation(id: number) {
    return operationRef.current?.id === id;
  }

  async function findFeeds() {
    setNewsStatus("RSSを探しています…");
    setRefreshing(true);
    setFeedCandidates([]);
    const operation = beginOperation();
    try {
      const result = await discoverNewsFeeds(feedUrl, {
        useDiscoveryHelper: settings.newsUseFeedDiscoveryHelper,
        useFeedFetchHelper: settings.newsUseFeedFetchHelper,
        signal: operation.controller.signal
      });
      if (!isCurrentOperation(operation.id)) return;
      setFeedCandidates(result.candidates);
      setNewsStatus(result.candidates.length === 1 ? "RSS候補を1件見つけました。内容を確認して追加してください。" : `RSS候補を${result.candidates.length}件見つけました。追加するものを選んでください。`);
    } catch (error) {
      if (!isCurrentOperation(operation.id) || operation.controller.signal.aborted) return;
      setNewsStatus(error instanceof Error ? error.message : "RSSを登録できませんでした。");
    } finally {
      if (isCurrentOperation(operation.id)) setRefreshing(false);
    }
  }

  async function addCandidate(candidate: NewsFeedCandidate) {
    setRefreshing(true);
    try {
      const feed = createNewsFeedFromCandidate(candidate, Date.now());
      const latest = await db.settings.get("local") ?? settings;
      if (latest.newsFeeds.some((item) => item.id === feed.id || item.url === feed.url)) {
        setNewsStatus("このRSSは登録済みです。");
        return;
      }
      const next = { ...latest, newsEnabled: true, newsFeeds: [...latest.newsFeeds, feed], updatedAt: Date.now() };
      await db.settings.put(next);
      await onChanged();
      setFeedCandidates([]);
      setFeedUrl("");
      await refreshFeeds({ ...next, newsFeeds: [feed] }, true);
    } catch (error) {
      setNewsStatus(error instanceof Error ? error.message : "RSSを登録できませんでした。");
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshFeeds(source = settings, force = true) {
    setRefreshing(true);
    setNewsStatus("ニュースを確認しています…");
    const operation = beginOperation();
    try {
      const report = await refreshNews(source, Date.now(), force, operation.controller.signal);
      if (!isCurrentOperation(operation.id)) return;
      await onChanged();
      setNewsStatus(
        report.checkedFeeds === 0
          ? "更新するRSSがありません。"
          : report.errors.length > 0
            ? `${report.successfulFeeds}件のRSSを更新。${report.errors.join(" ")}`
            : `${report.successfulFeeds}件のRSSから、新しいニュースを${report.addedItems}件保存しました。`
      );
    } catch (error) {
      if (!isCurrentOperation(operation.id) || operation.controller.signal.aborted) return;
      setNewsStatus(error instanceof Error ? error.message : "ニュースを更新できませんでした。");
    } finally {
      if (isCurrentOperation(operation.id)) setRefreshing(false);
    }
  }

  async function removeFeed(feedId: string) {
    operationRef.current?.controller.abort();
    await removeNewsFeed(feedId, settings);
    await onChanged();
    setNewsStatus("RSSを登録から外しました。");
  }

  return (
    <main className="feature-screen settings-screen">
      <ScreenHeader title="部屋の設定" onBack={onBack} />
      <section className="settings-list paper-panel">
        <h2>表示</h2>
        <label>文字の速さ<select value={settings.textSpeed} onChange={(event) => void patch({ textSpeed: event.target.value as GameSettings["textSpeed"] })}><option value="slow">ゆっくり</option><option value="normal">ふつう</option><option value="fast">はやい</option></select></label>
        <label>文字の大きさ<select value={settings.fontScale} onChange={(event) => void patch({ fontScale: event.target.value as GameSettings["fontScale"] })}><option value="small">小さめ</option><option value="normal">ふつう</option><option value="large">大きめ</option></select></label>
        <label className="toggle-row"><input type="checkbox" checked={settings.highContrast} onChange={(event) => void patch({ highContrast: event.target.checked })} />高いコントラスト</label>
        <label className="toggle-row"><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => void patch({ reducedMotion: event.target.checked })} />動きを減らす</label>
        <label className="toggle-row"><input type="checkbox" checked={settings.autonomousSpeech} onChange={(event) => void patch({ autonomousSpeech: event.target.checked })} />アグリちゃんから話しかける</label>

        <section className="settings-section" aria-labelledby="sound-settings-title">
          <h2 id="sound-settings-title">音</h2>
          <label>音量<input type="range" min={0} max={1} step={0.1} value={settings.volume} onChange={(event) => {
            const volume = Number(event.target.value);
            playGameSound("page", { muted: settings.muted, volume });
            void patch({ volume });
          }} /></label>
          <label className="toggle-row"><input type="checkbox" checked={settings.muted} onChange={(event) => {
            const muted = event.target.checked;
            if (!muted) playGameSound("confirm", { muted: false, volume: settings.volume });
            void patch({ muted });
          }} />ミュート</label>
          <button className="quiet settings-preview" type="button" disabled={settings.muted || settings.volume <= 0} onClick={() => playGameSound("confirm", settings)}><Volume2 aria-hidden="true" />音を試す</button>
          <p className="settings-help">会話開始、ページ送り、決定時の短い効果音です。声の読み上げではありません。</p>
        </section>

        <section className="settings-section news-settings" aria-labelledby="news-settings-title">
          <h2 id="news-settings-title">ニュース</h2>
          <label className="toggle-row"><input type="checkbox" checked={settings.newsEnabled} onChange={(event) => void patch({ newsEnabled: event.target.checked })} />ニュース機能を使う</label>
          <label>自動更新<select value={settings.newsRefreshMinutes} onChange={(event) => void patch({ newsRefreshMinutes: Number(event.target.value) as GameSettings["newsRefreshMinutes"] })}><option value={15}>15分ごと</option><option value={30}>30分ごと</option><option value={60}>1時間ごと</option><option value={180}>3時間ごと</option></select></label>
          <p className="settings-help">アプリを開いている間と、オンラインへ戻った時に更新を確認します。</p>
          <form className="rss-add-row" onSubmit={(event) => { event.preventDefault(); void findFeeds(); }}>
            <label>サイトまたはRSSのURL<input type="url" value={feedUrl} placeholder="https://example.com/" onChange={(event) => setFeedUrl(event.target.value)} /></label>
            <button className="quiet" type="submit" disabled={!feedUrl.trim() || refreshing}><Plus aria-hidden="true" />探して追加</button>
          </form>
          {feedCandidates.length > 0 ? (
            <ul className="rss-candidate-list" aria-label="見つかったRSS候補">
              {feedCandidates.map((candidate) => (
                <li key={candidate.canonicalUrl}>
                  <span><strong>{candidate.title}</strong><small>{candidate.format ? candidate.format.toUpperCase() : "形式未確認"}・{candidate.validation === "valid" ? "内容確認済み" : candidate.validation === "unverified" ? "ブラウザでは未確認" : "無効"}</small>{candidate.latestArticle ? <small>最新例: {candidate.latestArticle}</small> : null}</span>
                  <button className="quiet" type="button" disabled={refreshing || candidate.validation === "invalid"} onClick={() => void addCandidate(candidate)}>このRSSを追加</button>
                </li>
              ))}
            </ul>
          ) : null}
          <label className="toggle-row"><input type="checkbox" checked={settings.newsUseFeedDiscoveryHelper} onChange={(event) => void patch({ newsUseFeedDiscoveryHelper: event.target.checked })} />サイトからRSSを探す補助を使う</label>
          <p className="settings-help">許可すると、入力したサイトURLを feedsearch.dev へ送る場合があります。</p>
          <label className="toggle-row"><input type="checkbox" checked={settings.newsUseFeedFetchHelper} onChange={(event) => void patch({ newsUseFeedFetchHelper: event.target.checked })} />直接読めないRSSの取得補助を使う</label>
          <p className="settings-help">許可すると、登録したRSS URLを rss2json.com または jina.ai へ送る場合があります。保存するのは見出しと短い説明だけです。</p>
          <label className="toggle-row"><input type="checkbox" checked={settings.newsUseArticleHelper} onChange={(event) => void patch({ newsUseArticleHelper: event.target.checked })} />記事本文の取得補助を使う</label>
          <p className="settings-help">記事を選んだ時だけ、直接読めなかった記事URLを jina.ai へ送ることを許可します。<br /><a href="https://feedsearch.dev" target="_blank" rel="noreferrer">RSS検索: Feedsearch</a> / <a href="https://jina.ai/reader/" target="_blank" rel="noreferrer">取得補助: Reader</a></p>
          {settings.newsFeeds.length > 0 ? (
            <ul className="rss-feed-list">
              {settings.newsFeeds.map((feed) => (
                <li key={feed.id}>
                  <label className="toggle-row"><input type="checkbox" checked={feed.enabled} onChange={(event) => void patch({ newsFeeds: settings.newsFeeds.map((item) => item.id === feed.id ? { ...item, enabled: event.target.checked } : item) })} /><span><strong>{feed.name}</strong><small>{feed.lastError ?? (feed.lastSuccessAt ? `最終更新 ${new Date(feed.lastSuccessAt).toLocaleString("ja-JP")}` : "まだ更新していません")}</small></span></label>
                  <button className="icon-button" type="button" aria-label={`${feed.name}を削除`} title="RSSを削除" onClick={() => void removeFeed(feed.id)}><Trash2 aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="settings-help">RSSを登録すると、更新された見出しを端末内へ保存します。</p>}
          <button className="quiet" type="button" disabled={refreshing || settings.newsFeeds.every((feed) => !feed.enabled)} onClick={() => void refreshFeeds()}><RefreshCw aria-hidden="true" />{refreshing ? "確認中…" : "今すぐ更新"}</button>
          {newsStatus ? <p className="settings-status" role="status">{newsStatus}</p> : null}
        </section>
        <StorageStatus />
      </section>
    </main>
  );
}
