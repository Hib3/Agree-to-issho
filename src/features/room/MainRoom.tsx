import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterState } from "../../domain/model/character";
import type { Concept } from "../../domain/model/concept";
import type { ConversationSession } from "../../domain/model/conversation";
import type { NewsItem } from "../../domain/model/news";
import type { GameSettings, PlayerProfile } from "../../domain/model/player";
import { autonomousDelayMs, canScheduleAutonomousSpeech } from "../../domain/schedule/autonomousSpeech";
import { getTimeOfDay, timeLabels } from "../../domain/schedule/timeOfDay";
import { locations } from "../../data/locations/locations";
import { systemRandom } from "../../infrastructure/random/random";
import type { AppScreen } from "../../app/routes";
import { CharacterStage } from "../../ui/components/CharacterStage";
import { ChoiceButtons } from "../../ui/components/ChoiceButtons";
import { DialogueBox } from "../../ui/components/DialogueBox";
import {
  ArchiveRestore,
  BookOpenText,
  CircleHelp,
  DoorOpen,
  MapPinned,
  MessageCircle,
  Newspaper,
  NotebookTabs,
  Settings,
  Sparkles
} from "lucide-react";
import {
  advanceConversation,
  answerConversation,
  closeConversation,
  invalidateConversationSession,
  startConversation
} from "../conversation/conversationService";
import { validateConversationSession } from "../../domain/conversation/dialogueValidator";
import { isCurrentConversationSession } from "../../domain/conversation/sessionMigration";
import { playGameSound } from "../../infrastructure/audio/gameAudio";

type NewsInvitation = { item: NewsItem; matchedWord?: string | undefined };

export function MainRoom({
  player,
  character,
  settings,
  concepts,
  sessions,
  newsItems,
  saving,
  onNavigate,
  onChanged
}: {
  player: PlayerProfile;
  character: CharacterState;
  settings: GameSettings;
  concepts: Concept[];
  sessions: ConversationSession[];
  newsItems: NewsItem[];
  saving: boolean;
  onNavigate: (screen: AppScreen) => void;
  onChanged: () => Promise<void>;
}) {
  const rawActive = useMemo(
    () => [...sessions].reverse().find((session) => session.phase !== "completed"),
    [sessions]
  );
  const activeErrors = useMemo(
    () =>
      rawActive
        ? isCurrentConversationSession(rawActive)
          ? validateConversationSession(rawActive)
          : ["legacy_session"]
        : [],
    [rawActive]
  );
  const active = rawActive && activeErrors.length === 0 ? rawActive : undefined;
  const [selection, setSelection] = useState({ questionId: "", value: "" });
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [clock, setClock] = useState(() => Date.now());
  const [newsInvitation, setNewsInvitation] = useState<NewsInvitation | null>(null);
  const timerRef = useRef<number | null>(null);
  const location = locations.find((item) => item.id === character.currentLocationId) ?? locations[0]!;
  const timeOfDay = getTimeOfDay(clock);
  const weather = Math.floor(clock / 86_400_000) % 5 === 0 ? "rain" : "clear";
  const userWordCount = concepts.filter((concept) => concept.source === "user").length;
  const unreadNewsCount = newsItems.filter(
    (item) => item.discussionState !== "discussed" && !item.discussedAt
  ).length;
  const lastTurn = active?.history.at(-1);
  const dialogueText = newsInvitation
    ? newsInvitation.matchedWord
      ? `そういえばっ、「${newsInvitation.matchedWord}」が出てくるニュースが届いています。一緒に読んでみますかっ？`
      : "新しいニュースが届いていますっ。一緒に読んでみますかっ？"
    : rawActive && activeErrors.length > 0
      ? "会話メモを整え直しましたっ。もう一度、話しかけてくださいっ！"
      : active?.phase === "awaiting_answer" && active.pendingQuestion
        ? active.pendingQuestion.prompt
        : (lastTurn?.page ?? `${player.callName}っ！ 今日はどんな話をしましょうかっ？`);
  const hasNext = Boolean(active && active.phase !== "awaiting_answer" && active.phase !== "completed");

  const speak = useCallback(
    async (initiatedByUser = true) => {
      if (busy || saving) return;
      playGameSound(active ? "page" : initiatedByUser ? "talk" : "notice", settings);
      setBusy(true);
      try {
        if (active) await advanceConversation(active.id, Date.now(), initiatedByUser);
        else await startConversation(Date.now(), initiatedByUser);
        await onChanged();
      } finally {
        setBusy(false);
      }
    },
    [active, busy, onChanged, saving, settings]
  );

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!rawActive || activeErrors.length === 0) return;
    void invalidateConversationSession(rawActive.id, activeErrors).then(onChanged);
  }, [activeErrors, onChanged, rawActive]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (!settings.autonomousSpeech || active) return;
    const schedule = () => {
      const allowed = canScheduleAutonomousSpeech({
        screen: "room",
        documentVisible: !document.hidden,
        documentFocused: document.hasFocus(),
        isBusy: busy || saving,
        isInputting: false,
        hasPendingAnswer: false,
        character,
        location,
        now: Date.now()
      });
      if (!allowed) {
        timerRef.current = window.setTimeout(schedule, 5000);
        return;
      }
      timerRef.current = window.setTimeout(
        () => void speak(false),
        autonomousDelayMs(location, systemRandom)
      );
    };
    schedule();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [active, busy, character, location, saving, settings.autonomousSpeech, speak]);

  useEffect(() => {
    if (!settings.newsEnabled || rawActive || newsInvitation || newsItems.length === 0) return;
    const now = Date.now();
    const promptState = readNewsPromptState();
    if (now - promptState.lastPromptAt < 6 * 60 * 60 * 1000 || now < promptState.dismissedUntil) return;
    const unread = newsItems.filter(
      (item) =>
        item.discussionState !== "discussed" &&
        !item.discussedAt &&
        !promptState.suggestedItemIds.includes(item.id) &&
        !isSensitiveHeadline(`${item.title} ${item.summary}`)
    );
    const learnedMatch = unread
      .flatMap((item) =>
        concepts
          .filter((concept) => concept.source === "user" && concept.active)
          .map((concept) => ({ item, word: concept.surface }))
      )
      .find(({ item, word }) => `${item.title} ${item.summary}`.includes(word));
    const invitation = learnedMatch
      ? { item: learnedMatch.item, matchedWord: learnedMatch.word }
      : unread[0]
        ? { item: unread[0] }
        : null;
    if (!invitation) return;
    const timer = window.setTimeout(() => {
      setNewsInvitation(invitation);
      writeNewsPromptState({
        ...promptState,
        lastPromptAt: now,
        suggestedItemIds: [...promptState.suggestedItemIds, invitation.item.id].slice(-40)
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [concepts, newsInvitation, newsItems, rawActive, settings.newsEnabled]);

  async function submitAnswer() {
    if (!active?.pendingQuestion || selection.questionId !== active.pendingQuestion.id || !selection.value)
      return;
    const choice = active.pendingQuestion.choices.find((item) => item.id === selection.value);
    if (!choice) return;
    setBusy(true);
    try {
      playGameSound("confirm", settings);
      await answerConversation(active.id, choice);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function closeQuestion() {
    if (!active) return;
    setSelection({ questionId: "", value: "" });
    setBusy(true);
    try {
      playGameSound("page", settings);
      await closeConversation(active.id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  const answerOptions = useMemo(
    () => active?.pendingQuestion?.choices.map((choice) => ({ value: choice.id, label: choice.label })) ?? [],
    [active?.pendingQuestion]
  );
  const currentSelection =
    selection.questionId === active?.pendingQuestion?.id &&
    answerOptions.some((option) => option.value === selection.value)
      ? selection.value
      : "";

  return (
    <main className={`room-screen location-shell-${location.id}`}>
      <section
        className={`room-composition${active?.phase === "awaiting_answer" ? " answering" : ""}${newsInvitation ? " news-inviting" : ""}`}
      >
        <CharacterStage
          emotion={lastTurn?.emotion ?? character.emotion}
          locationId={location.id}
          timeOfDay={timeOfDay}
          weather={weather}
          reducedMotion={settings.reducedMotion}
          isSpeaking={hasNext}
        />
        <header className="room-topbar">
          <div className="place-chip">
            <strong>{timeLabels[timeOfDay]}</strong>
            <span>{location.name}</span>
          </div>
          <div className="room-status">
            <span>{online ? "端末内保存" : "オフライン"}</span>
            <span>言葉 {userWordCount}こ</span>
            <button
              className="icon-button"
              type="button"
              aria-label="設定"
              title="設定"
              onClick={() => onNavigate("settings")}
            >
              <Settings aria-hidden="true" />
            </button>
          </div>
        </header>
        <DialogueBox
          speaker="アグリちゃん"
          text={dialogueText}
          emotion={lastTurn?.emotion ?? character.emotion}
          textSpeed={settings.textSpeed}
          hasNext={hasNext}
          onNext={() => void speak()}
        />

        {active?.origin.type === "news" ? (
          <div className="active-news-source">
            <span>ニュースの記事について会話中</span>
            <a href={active.origin.sourceUrl} target="_blank" rel="noreferrer">
              元記事
            </a>
          </div>
        ) : null}

        {newsInvitation ? (
          <section className="news-invitation-actions" aria-label="ニュースの提案">
            <button
              className="primary"
              type="button"
              onClick={() => {
                setNewsInvitation(null);
                onNavigate("news");
              }}
            >
              ニュースを見る
            </button>
            <button
              className="quiet"
              type="button"
              onClick={() => {
                const promptState = readNewsPromptState();
                writeNewsPromptState({
                  ...promptState,
                  dismissedUntil: Date.now() + 24 * 60 * 60 * 1000
                });
                setNewsInvitation(null);
              }}
            >
              今は見ない
            </button>
          </section>
        ) : null}

        {active?.phase === "awaiting_answer" && active.pendingQuestion ? (
          <section className="answer-panel">
            <ChoiceButtons
              options={answerOptions}
              value={currentSelection}
              disabled={busy}
              onChoose={(value) => setSelection({ questionId: active.pendingQuestion!.id, value })}
              label="返事"
            />
            <button
              className="primary"
              type="button"
              disabled={!currentSelection || busy}
              onClick={() => void submitAnswer()}
            >
              この返事にする
            </button>
            <button
              className="quiet answer-navigation"
              type="button"
              disabled={busy}
              onClick={() => void closeQuestion()}
            >
              答えず話を閉じる
            </button>
          </section>
        ) : null}
        <div className="main-actions">
          <button
            className="primary"
            type="button"
            disabled={busy || saving || active?.phase === "awaiting_answer"}
            onClick={() => void speak()}
          >
            <MessageCircle aria-hidden="true" />
            {active ? "会話を続ける" : "話す"}
          </button>
          <button
            className="primary teach"
            type="button"
            disabled={busy || saving || Boolean(active)}
            onClick={() => onNavigate("teach")}
          >
            <Sparkles aria-hidden="true" />
            言葉を教える
          </button>
        </div>
      </section>

      <nav className="sub-actions" aria-label="補助メニュー">
        <button type="button" onClick={() => onNavigate("wordbook")}>
          <BookOpenText aria-hidden="true" />
          <span>単語帳</span>
        </button>
        <button type="button" onClick={() => onNavigate("diary")}>
          <NotebookTabs aria-hidden="true" />
          <span>日記</span>
        </button>
        <button type="button" onClick={() => onNavigate("locations")}>
          <MapPinned aria-hidden="true" />
          <span>移動</span>
        </button>
        {settings.newsEnabled ? (
          <button type="button" onClick={() => onNavigate("news")}>
            <Newspaper aria-hidden="true" />
            <span>ニュース{unreadNewsCount > 0 ? ` ${unreadNewsCount}` : ""}</span>
          </button>
        ) : null}
        <button type="button" onClick={() => onNavigate("backup")}>
          <ArchiveRestore aria-hidden="true" />
          <span>保存</span>
        </button>
        <button type="button" onClick={() => onNavigate("manual")}>
          <CircleHelp aria-hidden="true" />
          <span>説明</span>
        </button>
        <button type="button" onClick={() => onNavigate("title")}>
          <DoorOpen aria-hidden="true" />
          <span>タイトル</span>
        </button>
      </nav>
    </main>
  );
}

const NEWS_PROMPT_STORAGE_KEY = "aguri-news-prompt-v1";

function readNewsPromptState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(NEWS_PROMPT_STORAGE_KEY) ?? "{}") as Partial<{
      lastPromptAt: number;
      dismissedUntil: number;
      suggestedItemIds: string[];
    }>;
    return {
      lastPromptAt: Number(parsed.lastPromptAt) || 0,
      dismissedUntil: Number(parsed.dismissedUntil) || 0,
      suggestedItemIds: Array.isArray(parsed.suggestedItemIds) ? parsed.suggestedItemIds : []
    };
  } catch {
    return { lastPromptAt: 0, dismissedUntil: 0, suggestedItemIds: [] as string[] };
  }
}

function writeNewsPromptState(state: ReturnType<typeof readNewsPromptState>) {
  localStorage.setItem(NEWS_PROMPT_STORAGE_KEY, JSON.stringify(state));
}

function isSensitiveHeadline(text: string) {
  return /(死亡|死者|亡くな|重大事故|災害|地震|戦争|犯罪|逮捕|病気|医療|自傷|自殺|差別)/u.test(text);
}
