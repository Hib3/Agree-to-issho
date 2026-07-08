import { useEffect, useMemo, useState } from "react";
import { DebugPanel } from "../components/debug/DebugPanel";
import { DialogueBox } from "../components/DialogueBox";
import { createDebugWordSeed } from "../data/debug/debugWordSeed";
import { dialogueTemplates } from "../data/templates/dialogueTemplates";
import { TemplateDialogueEngine } from "../game/dialogue/TemplateDialogueEngine";
import { applyCorrectionToWord } from "../game/dialogue/drift";
import { deriveEventFlags } from "../game/events/eventRules";
import { exportSaveData, importSaveData, previewImport } from "../game/storage/exportImport";
import {
  characterStateRepository,
  diaryEntryRepository,
  dialogueLogRepository,
  eventFlagRepository,
  profileRepository,
  settingsRepository,
  wordRepository
} from "../game/storage/repositories";
import { nowIso } from "../utils/id";
import { DiaryScreen } from "../screens/DiaryScreen";
import { FirstStartWizard } from "../screens/FirstStartWizard";
import { ImportExportScreen } from "../screens/ImportExportScreen";
import { MainRoom } from "../screens/MainRoom";
import { ManualScreen } from "../screens/ManualScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { TeachWordFlow } from "../screens/TeachWordFlow";
import { TitleScreen } from "../screens/TitleScreen";
import { WordbookScreen } from "../screens/WordbookScreen";
import type {
  AppProfile,
  CharacterState,
  DiaryEntry,
  DialogueLog,
  DialogueTurn,
  EventFlag,
  GameSettings,
  ImportPreview,
  Screen,
  WordFrame
} from "../types/domain";

type AppState = {
  profile: AppProfile | null;
  characterState: CharacterState | null;
  settings: GameSettings | null;
  words: WordFrame[];
  dialogueLogs: DialogueLog[];
  diaryEntries: DiaryEntry[];
  eventFlags: EventFlag[];
};

const engine = new TemplateDialogueEngine();

const initialTurn: DialogueTurn = {
  speech_act: "greeting",
  text: "はァっいっ！\nおかえりなさいでございまァっすっ！\n今日はどんな言葉を連れてきたのかなァっ！",
  expression: "talk_smile",
  used_words: []
};

const initialState: AppState = {
  profile: null,
  characterState: null,
  settings: null,
  words: [],
  dialogueLogs: [],
  diaryEntries: [],
  eventFlags: []
};

export function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [state, setState] = useState<AppState>(initialState);
  const [turn, setTurn] = useState<DialogueTurn>(initialTurn);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    const [profile, characterState, settings, words, dialogueLogs, diaryEntries, eventFlags] = await Promise.all([
      profileRepository.get(),
      characterStateRepository.get(),
      settingsRepository.get(),
      wordRepository.list(),
      dialogueLogRepository.list(),
      diaryEntryRepository.list(),
      eventFlagRepository.list()
    ]);

    setState({
      profile: profile ?? null,
      characterState: characterState ?? null,
      settings: settings ?? null,
      words: words.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      dialogueLogs: (dialogueLogs as DialogueLog[]).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      diaryEntries: diaryEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date)),
      eventFlags: eventFlags as EventFlag[]
    });
  }

  useEffect(() => {
    refresh()
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "この端末の保存場所を開けませんでした。"))
      .finally(() => setIsLoading(false));
  }, []);

  const hasStarted = Boolean(state.profile && state.characterState && state.settings);
  const latestDiary = useMemo(() => state.diaryEntries[state.diaryEntries.length - 1], [state.diaryEntries]);

  async function handleFirstStart(playerName: string, characterName: string) {
    const now = nowIso();
    await profileRepository.save({ id: "local", player_name: playerName, created_at: now, updated_at: now });
    await characterStateRepository.save({
      id: "main",
      character_name: characterName,
      expression: "idle_smile",
      affection: 0,
      energy: 100,
      last_interaction_at: now,
      updated_at: now
    });
    await settingsRepository.save({
      id: "local",
      reduce_motion: false,
      text_speed: "normal",
      autosave: true,
      auto_talk: true,
      debug_panel: false,
      updated_at: now
    });
    await refresh();
    setTurn({
      speech_act: "greeting",
      text: `はァっいっ！\n${characterName}でございまァっすっ！\nあなたの言葉っ！めっちゃ覚えていきますよォっ！`,
      expression: "talk_smile",
      used_words: []
    });
    setScreen("main-room");
  }

  async function handleRoomAction(action: string) {
    if (action === "speak") return handleSpeak();
    if (action === "teach") return setScreen("teach-word");
    if (action === "wordbook") return setScreen("wordbook");
    if (action === "diary") return setScreen("diary");
    if (action === "settings") return setScreen("settings");
    if (action === "import-export") return setScreen("import-export");
    if (action === "manual") return setScreen("manual");
    if (action === "title") return setScreen("title");
  }

  async function handleSpeak() {
    const nextTurn = engine.next({
      profile: state.profile,
      character_state: state.characterState,
      settings: state.settings,
      words: state.words,
      dialogue_logs: state.dialogueLogs,
      diary_entries: state.diaryEntries,
      now: nowIso()
    });
    await persistDialogueTurn(nextTurn);
    setTurn(nextTurn);
    await refresh();
  }

  useEffect(() => {
    if (screen !== "main-room" || !hasStarted || state.settings?.auto_talk === false) return;
    const delayMs = state.settings?.reduce_motion ? 60000 : 42000;
    const timer = window.setTimeout(() => {
      void handleSpeak();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [screen, hasStarted, state.settings?.auto_talk, state.settings?.reduce_motion, turn.text, state.words.length, state.dialogueLogs.length]);

  async function persistDialogueTurn(nextTurn: DialogueTurn) {
    const now = nowIso();
    for (const used of nextTurn.used_words) {
      await wordRepository.save({
        ...used,
        use_count: used.use_count + 1,
        memory_strength: Math.min(1, used.memory_strength + 0.02),
        favorite_score: Math.min(1, used.favorite_score + 0.01),
        last_used_at: now,
        last_context_used: nextTurn.speech_act,
        updated_at: now
      });
    }
    await dialogueLogRepository.save({
      id: `log_${crypto.randomUUID()}`,
      speech_act: nextTurn.speech_act,
      text: nextTurn.text,
      used_word_ids: nextTurn.used_words.map((word) => word.id),
      emotion_code: nextTurn.emotion_code,
      motion_hint: nextTurn.motion_hint,
      created_at: now
    });
    if (state.characterState) {
      await characterStateRepository.save({
        ...state.characterState,
        expression: nextTurn.expression,
        last_interaction_at: now,
        updated_at: now
      });
    }
  }

  async function handleWordSaved(word: WordFrame) {
    await wordRepository.save(word);
    const words = [...state.words.filter((item) => item.id !== word.id), word];
    for (const flag of deriveEventFlags(words)) await eventFlagRepository.save(flag);
    setTurn({
      speech_act: "confirm_meaning",
      text: `「${word.surface}」っ！\n覚えまァっしたっ！\nまだふわふわしてるからっ、ときどき聞き直しますねェっ！`,
      expression: "proud",
      used_words: []
    });
    await refresh();
    setScreen("main-room");
  }

  async function handlePatchWord(wordId: string, patch: Partial<WordFrame>) {
    const word = await wordRepository.get(wordId);
    if (!word) return;
    await wordRepository.save({ ...word, ...patch, updated_at: nowIso() });
    await refresh();
  }

  async function handleGenerateDiary() {
    const entry = await engine.generateDiaryEntry({
      profile: state.profile,
      character_state: state.characterState,
      settings: state.settings,
      words: state.words,
      dialogue_logs: state.dialogueLogs,
      diary_entries: state.diaryEntries,
      now: nowIso()
    });
    await diaryEntryRepository.save(entry);
    await refresh();
  }

  async function handleDriftFeedback(mode: "correct" | "keep", note = "") {
    const target = turn.used_words[0];
    if (!target) return;
    const saved = await wordRepository.get(target.id);
    if (!saved) return;
    const now = nowIso();
    const nextWord = mode === "correct"
      ? applyCorrectionToWord(saved, note)
      : {
          ...saved,
          favorite_score: Math.min(1, saved.favorite_score + 0.03),
          updated_at: now
        };
    await wordRepository.save({ ...nextWord, updated_at: now });
    setTurn({
      speech_act: "praise_user",
      text: mode === "correct"
        ? `「${saved.surface}」っ、直してくれてありがとォっ！\n前よりちゃんと覚え直しまァっすっ！`
        : `「${saved.surface}」っ、このままでもいいんですねェっ！\nじゃあ、ちょっと不思議な感じもノートに残しますっ！`,
      expression: "proud",
      emotion_code: "proud",
      motion_hint: "sparkle",
      used_words: []
    });
    await refresh();
  }

  async function handleSettingsChange(patch: Partial<GameSettings>) {
    if (!state.settings) return;
    await settingsRepository.save({ ...state.settings, ...patch, updated_at: nowIso() });
    await refresh();
  }

  async function handleSeedSampleWords() {
    const sampleWords = createDebugWordSeed(state.words);
    for (const word of sampleWords) {
      await wordRepository.save(word);
    }
    const words = [...state.words, ...sampleWords];
    for (const flag of deriveEventFlags(words)) await eventFlagRepository.save(flag);
    if (sampleWords.length > 0) {
      setTurn({
        speech_act: "praise_user",
        text: `おためし用の言葉を${sampleWords.length}こ入れましたっ！\n単語帳と会話で、使い方を見られますよォっ！`,
        expression: "proud",
        used_words: []
      });
    }
    await refresh();
    return sampleWords.length;
  }

  async function handleExport() {
    const data = await exportSaveData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `with-aguri-save-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleApplyImport(preview: ImportPreview) {
    await importSaveData(preview);
    await refresh();
    setScreen("main-room");
  }

  if (isLoading) {
    return <div className="app-shell"><DialogueBox speaker="アグリちゃん" text="部屋を開いています。" /></div>;
  }

  return (
    <div className="app-shell">
      {error && <p className="warning">{error}</p>}
      {screen === "title" && (
        <TitleScreen
          hasStarted={hasStarted}
          wordCount={state.words.length}
          onStart={() => setScreen("first-start")}
          onContinue={() => setScreen(hasStarted ? "main-room" : "first-start")}
          onManual={() => setScreen("manual")}
          onSaveData={() => setScreen("import-export")}
          onSeedSampleWords={handleSeedSampleWords}
        />
      )}
      {screen === "first-start" && <FirstStartWizard onComplete={handleFirstStart} />}
      {screen === "main-room" && (
        <MainRoom
          profile={state.profile}
          characterState={state.characterState}
          words={state.words}
          latestDiary={latestDiary}
          turn={turn}
          onAction={handleRoomAction}
          onSeedSampleWords={handleSeedSampleWords}
          onDriftFeedback={handleDriftFeedback}
        />
      )}
      {screen === "teach-word" && <TeachWordFlow words={state.words} onCancel={() => setScreen("main-room")} onSave={handleWordSaved} />}
      {screen === "wordbook" && <WordbookScreen words={state.words} onBack={() => setScreen("main-room")} onPatchWord={handlePatchWord} />}
      {screen === "diary" && (
        <DiaryScreen
          entries={state.diaryEntries}
          words={state.words}
          onGenerate={handleGenerateDiary}
          onOpenWordbook={() => setScreen("wordbook")}
          onBack={() => setScreen("main-room")}
        />
      )}
      {screen === "settings" && <SettingsScreen settings={state.settings} onChange={handleSettingsChange} onBack={() => setScreen("main-room")} />}
      {screen === "import-export" && (
        <ImportExportScreen
          onBack={() => setScreen("main-room")}
          onExport={handleExport}
          onPreviewImport={previewImport}
          onApplyImport={handleApplyImport}
        />
      )}
      {screen === "manual" && <ManualScreen onBack={() => setScreen(hasStarted ? "main-room" : "title")} />}
      <DebugPanel
        settings={state.settings}
        words={state.words}
        onSeedSampleWords={handleSeedSampleWords}
      />
    </div>
  );
}
