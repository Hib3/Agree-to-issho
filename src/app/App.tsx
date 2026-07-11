import { useEffect, useMemo, useRef, useState } from "react";
import { DebugPanel } from "../components/debug/DebugPanel";
import { DialogueBox } from "../components/DialogueBox";
import { createDebugWordSeed } from "../data/debug/debugWordSeed";
import { dialogueTemplates } from "../data/templates/dialogueTemplates";
import { TemplateDialogueEngine } from "../game/dialogue/TemplateDialogueEngine";
import { advanceConversation, answerConversation, closeConversation, completeConversation, createConversationSession, createPlayerAnswerLog } from "../game/dialogue/conversationSession";
import { getAutoTalkDelay, shouldScheduleAutoTalk } from "../game/dialogue/autoTalk";
import { systemRandom } from "../game/dialogue/random";
import { applyCorrectionToWord } from "../game/dialogue/drift";
import { deriveEventFlags } from "../game/events/eventRules";
import { exportSaveData, importSaveData, previewImport } from "../game/storage/exportImport";
import {
  characterStateRepository,
  conversationSessionRepository,
  diaryEntryRepository,
  dialogueLogRepository,
  eventFlagRepository,
  profileRepository,
  settingsRepository,
  wordRelationRepository,
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
  ConversationSession,
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
  conversationSessions: ConversationSession[];
};

const engine = new TemplateDialogueEngine();

const initialTurn: DialogueTurn = {
  speech_act: "greeting",
  text: "おかえりなさいでございまァっすっ！\nアグリっ！\n今日はどんな言葉を連れてきたのかなァっ！",
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
  ,conversationSessions: []
};

export function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [state, setState] = useState<AppState>(initialState);
  const [turn, setTurn] = useState<DialogueTurn>(initialTurn);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [visibilityTick, setVisibilityTick] = useState(0);
  const [autoTalkDueAt, setAutoTalkDueAt] = useState<string | null>(null);
  const busyRef = useRef(false);

  async function refresh() {
    const [profile, characterState, settings, words, dialogueLogs, diaryEntries, eventFlags, conversationSessions] = await Promise.all([
      profileRepository.get(),
      characterStateRepository.get(),
      settingsRepository.get(),
      wordRepository.list(),
      dialogueLogRepository.list(),
      diaryEntryRepository.list(),
      eventFlagRepository.list()
      ,conversationSessionRepository.list()
    ]);

    setState({
      profile: profile ?? null,
      characterState: characterState ?? null,
      settings: settings ?? null,
      words: words.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      dialogueLogs: (dialogueLogs as DialogueLog[]).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      diaryEntries: diaryEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date)),
      eventFlags: eventFlags as EventFlag[]
      ,conversationSessions: (conversationSessions as ConversationSession[]).sort((a, b) => a.started_at.localeCompare(b.started_at))
    });
  }

  useEffect(() => {
    refresh()
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "この端末の保存場所を開けませんでした。"))
      .finally(() => setIsLoading(false));
  }, []);

  const hasStarted = Boolean(state.profile && state.characterState && state.settings);
  const latestDiary = useMemo(() => state.diaryEntries[state.diaryEntries.length - 1], [state.diaryEntries]);
  const activeSession = useMemo(
    () => [...state.conversationSessions].reverse().find((session) => session.phase !== "completed") ?? null,
    [state.conversationSessions]
  );

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
      last_user_interaction_at: now,
      last_character_speech_at: now,
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
      text: `${characterName}でございまァっすっ！\nアグリっ！\nあなたの言葉をめっちゃ覚えていくよォっ！`,
      expression: "talk_smile",
      used_words: []
    });
    setScreen("main-room");
  }

  async function handleRoomAction(action: string) {
    if (action === "speak") return activeSession ? handleContinueConversation() : handleSpeak();
    if (action === "teach") return setScreen("teach-word");
    if (action === "wordbook") return setScreen("wordbook");
    if (action === "diary") return setScreen("diary");
    if (action === "settings") return setScreen("settings");
    if (action === "import-export") return setScreen("import-export");
    if (action === "manual") return setScreen("manual");
    if (action === "title") return setScreen("title");
  }

  useEffect(() => {
    if (screen !== "main-room" || !activeSession) return;
    const latestLog = [...state.dialogueLogs].reverse().find((log) => log.session_id === activeSession.id && log.role === "character");
    if (!latestLog) return;
    const usedWords = activeSession.topic_word_ids.map((id) => state.words.find((word) => word.id === id)).filter(Boolean) as WordFrame[];
    setTurn({
      speech_act: latestLog.speech_act ?? "use_word_in_daily_talk",
      text: latestLog.text,
      expression: state.characterState?.expression ?? "talk_normal",
      emotion_code: latestLog.emotion_code,
      motion_hint: latestLog.motion_hint,
      used_words: usedWords,
      template_id: latestLog.template_id,
      semantic_key: latestLog.semantic_key,
      session_id: activeSession.id,
      requires_answer: activeSession.phase === "awaiting_answer",
      ...(activeSession.phase === "awaiting_answer" && activeSession.question_kind !== "none" ? {
        answer_schema: {
          kind: activeSession.question_kind ?? "single_choice",
          ...(activeSession.answer_options ? { options: activeSession.answer_options } : {}),
          ...(activeSession.question_kind === "free_text" ? { placeholder: "60文字まで", max_length: 60 } : {})
        }
      } : {})
    });
  }, [screen, activeSession?.id, activeSession?.phase]);

  async function handleSpeak(isUserAction = true) {
    if (busyRef.current || activeSession) return;
    busyRef.current = true;
    setIsBusy(true);
    try {
      const now = nowIso();
      const nextTurn = engine.next({
        profile: state.profile,
        character_state: state.characterState,
        settings: state.settings,
        words: state.words,
        dialogue_logs: state.dialogueLogs,
        diary_entries: state.diaryEntries,
        conversation_sessions: state.conversationSessions,
        conversation_session: activeSession,
        now
      });
      const log = await persistDialogueTurn(nextTurn, isUserAction);
      if (nextTurn.requires_answer || nextTurn.continuation?.length) {
        await conversationSessionRepository.save({
          ...createConversationSession(nextTurn, now),
          prompt_log_id: log.id
        });
      }
      setTurn(nextTurn);
      await refresh();
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }

  useEffect(() => {
    const onVisibility = () => setVisibilityTick((value) => value + 1);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!hasStarted || !shouldScheduleAutoTalk({
      screen,
      enabled: state.settings?.auto_talk !== false,
      hidden: document.hidden,
      busy: isBusy,
      session: activeSession,
      lastUserInteractionAt: state.characterState?.last_user_interaction_at,
      now: Date.now()
    })) {
      setAutoTalkDueAt(null);
      return;
    }
    const delayMs = getAutoTalkDelay(systemRandom);
    setAutoTalkDueAt(new Date(Date.now() + delayMs).toISOString());
    const timer = window.setTimeout(() => {
      if (!document.hidden && !busyRef.current) void handleSpeak(false);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      setAutoTalkDueAt(null);
    };
  }, [screen, hasStarted, state.settings?.auto_talk, activeSession?.id, activeSession?.phase, isBusy, turn.text, state.words.length, state.dialogueLogs.length, visibilityTick]);

  async function persistDialogueTurn(nextTurn: DialogueTurn, isUserAction = false) {
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
    const log: DialogueLog = {
      id: `log_${crypto.randomUUID()}`,
      session_id: nextTurn.session_id ?? `session_${crypto.randomUUID()}`,
      role: "character",
      speech_act: nextTurn.speech_act,
      ...(nextTurn.template_id ? { template_id: nextTurn.template_id } : {}),
      ...(nextTurn.semantic_key ? { semantic_key: nextTurn.semantic_key } : {}),
      text: nextTurn.text,
      used_word_ids: nextTurn.used_words.map((word) => word.id),
      emotion_code: nextTurn.emotion_code,
      motion_hint: nextTurn.motion_hint,
      created_at: now
    };
    await dialogueLogRepository.save(log);
    if (state.characterState) {
      await characterStateRepository.save({
        ...state.characterState,
        expression: nextTurn.expression,
        ...(isUserAction ? { last_interaction_at: now, last_user_interaction_at: now } : {}),
        last_character_speech_at: now,
        energy: Math.max(0, state.characterState.energy - (isUserAction ? 1 : 0.5)),
        updated_at: now
      });
    }
    return log;
  }

  async function handleConversationAnswer(value: string, freeText = "") {
    if (!activeSession || activeSession.phase !== "awaiting_answer" || busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    try {
      const now = nowIso();
      const result = answerConversation(activeSession, value, state.words, now, freeText);
      await dialogueLogRepository.save(createPlayerAnswerLog(activeSession, value, freeText, now));
      for (const word of result.updated_words) await wordRepository.save(word);
      if (result.relation) await wordRelationRepository.save(result.relation);
      await conversationSessionRepository.save(result.session);
      await persistDialogueTurn(result.turn, false);
      if (state.characterState) {
        await characterStateRepository.save({
          ...state.characterState,
          affection: Math.min(100, state.characterState.affection + 1),
          energy: Math.max(0, state.characterState.energy - 1),
          last_interaction_at: now,
          last_user_interaction_at: now,
          updated_at: now
        });
      }
      setTurn(result.turn);
      await refresh();
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }

  async function handleContinueConversation() {
    if (!activeSession || activeSession.phase === "awaiting_answer" || busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    try {
      const now = nowIso();
      if (activeSession.phase === "follow_up") {
        const next = advanceConversation(activeSession, state.words, now);
        if (next) {
          await conversationSessionRepository.save(next.session);
          await persistDialogueTurn(next.turn, true);
          setTurn(next.turn);
          await refresh();
          return;
        }
      }
      if (activeSession.phase === "closing") {
        await conversationSessionRepository.save(completeConversation(activeSession, now));
        await refresh();
        return;
      }
      const word = state.words.find((item) => item.id === activeSession.topic_word_ids[0]);
      const result = closeConversation(activeSession, word, now);
      await conversationSessionRepository.save(result.session);
      await persistDialogueTurn(result.turn, true);
      setTurn(result.turn);
      await refresh();
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }

  async function handleWordSaved(word: WordFrame) {
    await wordRepository.save(word);
    const words = [...state.words.filter((item) => item.id !== word.id), word];
    for (const flag of deriveEventFlags(words)) await eventFlagRepository.save(flag);
    const learnedTurn: DialogueTurn = {
      speech_act: "confirm_meaning",
      text: `「${word.surface}」っ！\nノートに覚えておきまァっすっ！\nまだふわふわしてるからっ、ときどき聞き直しますねェっ！`,
      expression: "proud",
      emotion_code: "proud",
      motion_hint: "sparkle",
      template_id: "learning_saved",
      semantic_key: "learning.word.saved",
      session_id: `session_${crypto.randomUUID()}`,
      used_words: []
    };
    await persistDialogueTurn(learnedTurn, true);
    if (state.characterState) {
      const now = nowIso();
      await characterStateRepository.save({
        ...state.characterState,
        affection: Math.min(100, state.characterState.affection + 1),
        energy: Math.max(0, state.characterState.energy - 1),
        last_user_interaction_at: now,
        last_interaction_at: now,
        updated_at: now
      });
    }
    setTurn(learnedTurn);
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
    const today = nowIso().slice(0, 10);
    if (state.diaryEntries.some((entry) => entry.entry_date === today)) return;
    const entry = await engine.generateDiaryEntry({
      profile: state.profile,
      character_state: state.characterState,
      settings: state.settings,
      words: state.words,
      dialogue_logs: state.dialogueLogs,
      diary_entries: state.diaryEntries,
      conversation_sessions: state.conversationSessions,
      now: nowIso()
    });
    await diaryEntryRepository.save(entry);
    await refresh();
  }

  async function handleDriftFeedback(mode: "correct" | "keep", note = "") {
    const usedIds = Array.from(new Set(turn.used_words.map((word) => word.id)));
    if (usedIds.length === 0) return;
    const savedWords = (await Promise.all(usedIds.map((id) => wordRepository.get(id))))
      .filter((word): word is WordFrame => Boolean(word));
    const saved = savedWords[0];
    if (!saved) return;
    const now = nowIso();
    for (const word of savedWords) {
      const otherIds = usedIds.filter((id) => id !== word.id);
      const nextWord = mode === "correct"
        ? {
            ...(word.id === saved.id ? applyCorrectionToWord(word, note) : word),
            related_word_ids: word.related_word_ids.filter((id) => !otherIds.includes(id)),
            review_count: word.review_count + 1,
            source_question_ids: Array.from(new Set([...word.source_question_ids, "composition_relation_corrected"])),
            updated_at: now
          }
        : {
            ...word,
            related_word_ids: Array.from(new Set([...word.related_word_ids, ...otherIds])),
            favorite_score: Math.min(1, word.favorite_score + 0.03),
            ambiguity_score: Math.max(0, word.ambiguity_score - 0.03),
            source_question_ids: Array.from(new Set([...word.source_question_ids, "composition_relation_kept"])),
            updated_at: now
          };
      await wordRepository.save(nextWord);
    }
    if (mode === "keep") {
      for (let fromIndex = 0; fromIndex < savedWords.length; fromIndex += 1) {
        for (let toIndex = fromIndex + 1; toIndex < savedWords.length; toIndex += 1) {
          await wordRelationRepository.save({
            id: `relation_${savedWords[fromIndex].id}_${savedWords[toIndex].id}`,
            from_word_id: savedWords[fromIndex].id,
            to_word_id: savedWords[toIndex].id,
            relation_type: "user_linked",
            confidence: 0.9,
            created_at: now
          });
        }
      }
    } else {
      const relations = await wordRelationRepository.list();
      for (const relation of relations) {
        if (usedIds.includes(relation.from_word_id) && usedIds.includes(relation.to_word_id)) {
          await wordRelationRepository.remove(relation.id);
        }
      }
    }
    const surfaces = savedWords.map((word) => `「${word.surface}」`).join("と");
    const feedbackTurn: DialogueTurn = {
      speech_act: "praise_user",
      text: mode === "correct"
        ? `${surfaces}のつながりっ、直してくれてありがとうございまァっすっ！\nこの組み合わせは混ぜないように覚え直しまァっすっ！`
        : `${surfaces}っ、このつながりでいいんですねェっ！\nじゃあ、アグリのノートに一緒に残しますっ！`,
      expression: "proud",
      emotion_code: "proud",
      motion_hint: "sparkle",
      template_id: mode === "correct" ? "correction_accepted" : "drift_kept",
      semantic_key: mode === "correct" ? "review.correction.accepted" : "drift.user.accepted",
      session_id: turn.session_id ?? `session_${crypto.randomUUID()}`,
      used_words: []
    };
    await persistDialogueTurn(feedbackTurn, true);
    setTurn(feedbackTurn);
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
          activeSession={activeSession}
          isBusy={isBusy}
          onAnswer={handleConversationAnswer}
          onAdvance={handleContinueConversation}
          textSpeed={state.settings?.text_speed ?? "normal"}
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
        debugInfo={engine.lastDebug}
        session={activeSession}
        characterState={state.characterState}
        autoTalkEnabled={screen === "main-room" && state.settings?.auto_talk !== false && !activeSession && !document.hidden}
        autoTalkDueAt={autoTalkDueAt}
      />
    </div>
  );
}
