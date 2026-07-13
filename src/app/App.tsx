import { useEffect } from "react";
import { useGameStore } from "./providers";
import { TitleScreen } from "../features/onboarding/TitleScreen";
import { FirstStartWizard } from "../features/onboarding/FirstStartWizard";
import { MainRoom } from "../features/room/MainRoom";
import { TeachWordFlow } from "../features/teach-word/TeachWordFlow";
import { WordbookScreen } from "../features/wordbook/WordbookScreen";
import { DiaryScreen } from "../features/diary/DiaryScreen";
import { LocationsScreen } from "../features/locations/LocationsScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { BackupScreen } from "../features/backup/BackupScreen";
import { ManualScreen } from "../features/settings/ManualScreen";
import { resetGameData } from "./bootstrap";
import { NewsScreen } from "../features/news/NewsScreen";
import { refreshNews, shouldRefreshNews } from "../infrastructure/news/newsService";

export function App() {
  const store = useGameStore();
  const initialize = store.initialize;
  const settings = store.settings;
  const refresh = store.refresh;
  const screen = !store.player && store.screen !== "onboarding" ? "onboarding" : store.screen;

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [screen]);

  useEffect(() => {
    if (!settings?.newsEnabled || settings.newsFeeds.length === 0) return;
    let running = false;
    const update = async () => {
      if (running || !shouldRefreshNews(settings)) return;
      running = true;
      try {
        await refreshNews(settings);
        await refresh();
      } finally {
        running = false;
      }
    };
    void update();
    const timer = window.setInterval(() => void update(), 60_000);
    const handleOnline = () => void update();
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", handleOnline);
    };
  }, [settings, refresh]);

  if (store.loading) return <main className="loading-screen">部屋を開いています…</main>;
  if (store.error) return <main className="error-screen"><h1>部屋を開けませんでした</h1><p>{store.error}</p><button type="button" onClick={() => location.reload()}>もう一度</button></main>;

  const userWordCount = store.concepts.filter((concept) => concept.source === "user").length;
  const rootClass = [store.settings?.highContrast ? "high-contrast" : "", store.settings ? `font-${store.settings.fontScale}` : ""].filter(Boolean).join(" ");

  async function startNewGame() {
    if (store.player && !window.confirm("教えた言葉、会話、日記をこの端末から消して、最初から始めますか？\n必要なら先に保存データを作ってください。")) return;
    await resetGameData();
    await store.initialize();
  }

  return (
    <div className={rootClass}>
      {screen === "title" ? (
        <TitleScreen
          hasSave={Boolean(store.player)}
          userWordCount={userWordCount}
          onContinue={() => store.setScreen("room")}
          onStart={() => { void startNewGame(); }}
          onManual={() => store.setScreen("manual")}
          onBackup={() => store.setScreen("backup")}
        />
      ) : null}
      {screen === "onboarding" ? (
        <FirstStartWizard onComplete={async () => { await store.refresh(); store.setScreen("teach"); }} />
      ) : null}
      {screen === "room" && store.player && store.character && store.settings ? (
        <MainRoom
          player={store.player}
          character={store.character}
          settings={store.settings}
          concepts={store.concepts}
          sessions={store.sessions}
          newsItems={store.newsItems}
          saving={store.saving}
          onNavigate={store.setScreen}
          onChanged={store.refresh}
        />
      ) : null}
      {screen === "teach" ? (
        <TeachWordFlow
          concepts={store.concepts}
          initialSession={store.learningSession}
          locationId={store.character?.currentLocationId ?? "room"}
          onChanged={store.refresh}
          onComplete={() => { void store.refresh(); store.setScreen("room"); }}
        />
      ) : null}
      {screen === "wordbook" ? <WordbookScreen concepts={store.concepts} onChanged={store.refresh} onBack={() => store.setScreen("room")} /> : null}
      {screen === "diary" ? <DiaryScreen concepts={store.concepts} memories={store.memories} dialogue={store.dialogue} diaries={store.diaries} onChanged={store.refresh} onBack={() => store.setScreen("room")} /> : null}
      {screen === "locations" && store.character ? <LocationsScreen character={store.character} onChanged={store.refresh} onBack={() => store.setScreen("room")} /> : null}
      {screen === "settings" && store.settings ? <SettingsScreen settings={store.settings} onChanged={store.refresh} onBack={() => store.setScreen("room")} /> : null}
      {screen === "news" && store.settings ? <NewsScreen items={store.newsItems} concepts={store.concepts} character={store.character ?? undefined} relations={store.relations} memories={store.memories} settings={store.settings} onChanged={store.refresh} onOpenSettings={() => store.setScreen("settings")} onBack={() => store.setScreen("room")} /> : null}
      {screen === "backup" ? <BackupScreen onChanged={store.refresh} onBack={() => store.setScreen(store.player ? "room" : "title")} /> : null}
      {screen === "manual" ? <ManualScreen onBack={() => store.setScreen(store.player ? "room" : "title")} /> : null}
    </div>
  );
}
