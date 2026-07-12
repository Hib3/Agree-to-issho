import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterState } from "../../domain/model/character";
import type { Concept } from "../../domain/model/concept";
import type { ConversationSession } from "../../domain/model/conversation";
import type { GameSettings, PlayerProfile } from "../../domain/model/player";
import { autonomousDelayMs, canScheduleAutonomousSpeech } from "../../domain/schedule/autonomousSpeech";
import { getTimeOfDay, timeLabels } from "../../domain/schedule/timeOfDay";
import { locations } from "../../data/locations/locations";
import { systemRandom } from "../../infrastructure/random/random";
import type { AppScreen } from "../../app/routes";
import { CharacterStage } from "../../ui/components/CharacterStage";
import { ChoiceButtons } from "../../ui/components/ChoiceButtons";
import { DialogueBox } from "../../ui/components/DialogueBox";
import { ArchiveRestore, BookOpenText, CircleHelp, DoorOpen, MapPinned, MessageCircle, NotebookTabs, Settings, Sparkles } from "lucide-react";
import { advanceConversation, answerConversation, startConversation } from "../conversation/conversationService";

export function MainRoom({ player, character, settings, concepts, sessions, saving, onNavigate, onChanged }: {
  player: PlayerProfile;
  character: CharacterState;
  settings: GameSettings;
  concepts: Concept[];
  sessions: ConversationSession[];
  saving: boolean;
  onNavigate: (screen: AppScreen) => void;
  onChanged: () => Promise<void>;
}) {
  const active = [...sessions].reverse().find((session) => session.phase !== "completed");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [clock, setClock] = useState(() => Date.now());
  const timerRef = useRef<number | null>(null);
  const location = locations.find((item) => item.id === character.currentLocationId) ?? locations[0]!;
  const timeOfDay = getTimeOfDay(clock);
  const userWordCount = concepts.filter((concept) => concept.source === "user").length;
  const lastTurn = active?.history.at(-1);
  const dialogueText = active?.phase === "awaiting_answer" && active.pendingQuestion
    ? active.pendingQuestion.prompt
    : lastTurn?.page ?? `まァっ、${player.callName}っ！ 今日はどんな話をしましょうかっ？`;
  const hasNext = Boolean(active && active.phase !== "awaiting_answer" && active.phase !== "completed");

  const speak = useCallback(async (initiatedByUser = true) => {
    if (busy || saving) return;
    setBusy(true);
    try {
      if (active) await advanceConversation(active.id, Date.now(), initiatedByUser);
      else await startConversation(Date.now(), initiatedByUser);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }, [active, busy, onChanged, saving]);

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
      timerRef.current = window.setTimeout(() => void speak(false), autonomousDelayMs(location, systemRandom));
    };
    schedule();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [active, busy, character, location, saving, settings.autonomousSpeech, speak]);

  async function submitAnswer() {
    if (!active?.pendingQuestion || !selected) return;
    const choice = active.pendingQuestion.choices.find((item) => item.id === selected);
    if (!choice) return;
    setBusy(true);
    try {
      await answerConversation(active.id, choice);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  const answerOptions = useMemo(
    () => active?.pendingQuestion?.choices.map((choice) => ({ value: choice.id, label: choice.label })) ?? [],
    [active?.pendingQuestion]
  );
  const currentSelection = answerOptions.some((option) => option.value === selected) ? selected : "";

  return (
    <main className={`room-screen location-shell-${location.id}`}>
      <section className={`room-composition${active?.phase === "awaiting_answer" ? " answering" : ""}`}>
        <CharacterStage emotion={lastTurn?.emotion ?? character.emotion} locationId={location.id} timeOfDay={timeOfDay} reducedMotion={settings.reducedMotion} isSpeaking={Boolean(active)} />
        <header className="room-topbar">
          <div className="place-chip"><strong>{timeLabels[timeOfDay]}</strong><span>{location.name}</span></div>
          <div className="room-status"><span>{online ? "端末内保存" : "オフライン"}</span><span>言葉 {userWordCount}こ</span><button className="icon-button" type="button" aria-label="設定" title="設定" onClick={() => onNavigate("settings")}><Settings aria-hidden="true" /></button></div>
        </header>
        <DialogueBox speaker="アグリちゃん" text={dialogueText} emotion={lastTurn?.emotion ?? character.emotion} textSpeed={settings.textSpeed} hasNext={hasNext} onNext={() => void speak()} />

        {active?.phase === "awaiting_answer" && active.pendingQuestion ? (
          <section className="answer-panel">
            <ChoiceButtons options={answerOptions} value={currentSelection} disabled={busy} onChoose={setSelected} label="返事" />
            <button className="primary" type="button" disabled={!currentSelection || busy} onClick={() => void submitAnswer()}>この返事にする</button>
          </section>
        ) : null}
        <div className="main-actions">
          <button className="primary" type="button" disabled={busy || saving || active?.phase === "awaiting_answer"} onClick={() => void speak()}><MessageCircle aria-hidden="true" />{active ? "会話を続ける" : "話す"}</button>
          <button className="primary teach" type="button" disabled={busy || saving || Boolean(active)} onClick={() => onNavigate("teach")}><Sparkles aria-hidden="true" />言葉を教える</button>
        </div>
      </section>

      <nav className="sub-actions" aria-label="補助メニュー">
        <button type="button" onClick={() => onNavigate("wordbook")}><BookOpenText aria-hidden="true" /><span>単語帳</span></button>
        <button type="button" onClick={() => onNavigate("diary")}><NotebookTabs aria-hidden="true" /><span>日記</span></button>
        <button type="button" onClick={() => onNavigate("locations")}><MapPinned aria-hidden="true" /><span>移動</span></button>
        <button type="button" onClick={() => onNavigate("backup")}><ArchiveRestore aria-hidden="true" /><span>保存</span></button>
        <button type="button" onClick={() => onNavigate("manual")}><CircleHelp aria-hidden="true" /><span>説明</span></button>
        <button type="button" onClick={() => onNavigate("title")}><DoorOpen aria-hidden="true" /><span>タイトル</span></button>
      </nav>
    </main>
  );
}
