import { useState } from "react";
import { Plus, RefreshCw, Trash2, Volume2 } from "lucide-react";
import type { GameSettings } from "../../domain/model/player";
import { playGameSound } from "../../infrastructure/audio/gameAudio";
import { db } from "../../infrastructure/db/database";
import { createNewsFeed, refreshNews, removeNewsFeed } from "../../infrastructure/news/newsService";
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

  async function patch(changes: Partial<GameSettings>) {
    const next = { ...settings, ...changes, updatedAt: Date.now() };
    setDraftSettings(next);
    try {
      await db.settings.put(next);
      await onChanged();
      return next;
    } finally {
      setDraftSettings((current) => current === next ? null : current);
    }
  }

  async function addFeed() {
    setNewsStatus("");
    try {
      const feed = createNewsFeed(feedUrl);
      if (settings.newsFeeds.some((item) => item.url === feed.url)) {
        setNewsStatus("このRSSは登録済みです。");
        return;
      }
      const next = await patch({ newsEnabled: true, newsFeeds: [...settings.newsFeeds, feed] });
      setFeedUrl("");
      await refreshFeeds(next, true);
    } catch (error) {
      setNewsStatus(error instanceof Error ? error.message : "RSSを登録できませんでした。");
    }
  }

  async function refreshFeeds(source = settings, force = true) {
    setRefreshing(true);
    setNewsStatus("ニュースを確認しています…");
    try {
      const report = await refreshNews(source, Date.now(), force);
      await onChanged();
      setNewsStatus(
        report.checkedFeeds === 0
          ? "更新するRSSがありません。"
          : report.errors.length > 0
            ? `${report.successfulFeeds}件のRSSを更新。${report.errors.join(" ")}`
            : `${report.successfulFeeds}件のRSSから、新しいニュースを${report.addedItems}件保存しました。`
      );
    } catch (error) {
      setNewsStatus(error instanceof Error ? error.message : "ニュースを更新できませんでした。");
    } finally {
      setRefreshing(false);
    }
  }

  async function removeFeed(feedId: string) {
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
          <form className="rss-add-row" onSubmit={(event) => { event.preventDefault(); void addFeed(); }}>
            <label>RSS URL<input type="url" value={feedUrl} placeholder="https://example.com/feed.xml" onChange={(event) => setFeedUrl(event.target.value)} /></label>
            <button className="quiet" type="submit" disabled={!feedUrl.trim() || refreshing}><Plus aria-hidden="true" />追加</button>
          </form>
          <label className="toggle-row"><input type="checkbox" checked={settings.newsUseRss2Json} onChange={(event) => void patch({ newsUseRss2Json: event.target.checked })} />直接読めないRSSの取得補助を使う</label>
          <p className="settings-help">取得補助を有効にすると、登録したRSS URLだけが rss2json.com へ送られます。記事全文は保存しません。</p>
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
