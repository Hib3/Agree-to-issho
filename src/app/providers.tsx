import { create } from "zustand";
import type { ReactNode } from "react";
import type { AppScreen } from "./routes";
import type { CharacterState } from "../domain/model/character";
import type { Concept } from "../domain/model/concept";
import type { ConversationSession, DialogueHistoryEntry } from "../domain/model/conversation";
import type { DiaryEntry, MemoryEvent } from "../domain/model/memory";
import type { GameSettings, PlayerProfile } from "../domain/model/player";
import type { ConceptRelation } from "../domain/model/relation";
import type { LearningSession } from "../domain/learning/learningMachine";
import type { NewsItem } from "../domain/model/news";
import { bootstrapApp, loadSnapshot } from "./bootstrap";

type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>;
type GameStore = Snapshot & {
  screen: AppScreen;
  loading: boolean;
  saving: boolean;
  error: string;
  setScreen: (screen: AppScreen) => void;
  setSaving: (saving: boolean) => void;
  refresh: () => Promise<void>;
  initialize: () => Promise<void>;
};

const empty: Snapshot = {
  player: null as PlayerProfile | null,
  character: null as CharacterState | null,
  settings: null as GameSettings | null,
  concepts: [] as Concept[],
  relations: [] as ConceptRelation[],
  memories: [] as MemoryEvent[],
  sessions: [] as ConversationSession[],
  dialogue: [] as DialogueHistoryEntry[],
  diaries: [] as DiaryEntry[],
  learningSession: null as LearningSession | null,
  newsItems: [] as NewsItem[]
};

let bootstrapPromise: Promise<Snapshot> | null = null;

function initializeOnce() {
  bootstrapPromise ??= bootstrapApp().finally(() => {
    bootstrapPromise = null;
  });
  return bootstrapPromise;
}

export const useGameStore = create<GameStore>((set) => ({
  ...empty,
  screen: "title",
  loading: true,
  saving: false,
  error: "",
  setScreen: (screen) => set({ screen }),
  setSaving: (saving) => set({ saving }),
  refresh: async () => set(await loadSnapshot()),
  initialize: async () => {
    try {
      const snapshot = await initializeOnce();
      set({ ...snapshot, loading: false, screen: snapshot.player ? "title" : "onboarding" });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : "保存場所を開けませんでした。" });
    }
  }
}));

export function AppProviders({ children }: { children: ReactNode }) {
  return children;
}
