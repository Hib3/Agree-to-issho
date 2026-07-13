import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createUserConcept } from "../domain/learning/conceptFactory";
import type { CharacterState } from "../domain/model/character";
import type { CompositionProposition, ConversationSession } from "../domain/model/conversation";
import type { GameSettings, PlayerProfile } from "../domain/model/player";
import { answerSchemaFor } from "../domain/conversation/semanticComposition";
import { MainRoom } from "../features/room/MainRoom";

const serviceMocks = vi.hoisted(() => ({
  advanceConversation: vi.fn(),
  answerConversation: vi.fn(),
  closeConversation: vi.fn().mockResolvedValue(undefined),
  invalidateConversationSession: vi.fn(),
  startConversation: vi.fn()
}));

vi.mock("../features/conversation/conversationService", () => serviceMocks);

const now = 1_700_000_000_000;
const player: PlayerProfile = { id: "local", name: "意味QA", callName: "意味QA", createdAt: now, updatedAt: now };
const character: CharacterState = {
  id: "aguri",
  name: "アグリちゃん",
  emotion: "curious",
  energy: 80,
  closeness: 20,
  curiosity: 0.8,
  socialNeed: 20,
  trust: 20,
  boredom: 0,
  currentLocationId: "room",
  lastUserInteractionAt: now,
  lastSpeechAt: now,
  updatedAt: now
};
const settings: GameSettings = {
  id: "local",
  textSpeed: "fast",
  fontScale: "normal",
  highContrast: false,
  reducedMotion: true,
  volume: 0,
  muted: true,
  audioRevision: 1,
  autonomousSpeech: false,
  newsEnabled: false,
  newsRefreshMinutes: 30,
  newsUseRss2Json: false,
  newsFeeds: [],
  updatedAt: now
};
const adult = createUserConcept({ surface: "おとな", category: "person_descriptor" }, now, "room-test-adult");
const bonito = createUserConcept({ surface: "かつお節", category: "food_drink" }, now, "room-test-bonito");
const proposition: CompositionProposition = {
  wordIds: [adult.id, bonito.id],
  frameId: "test.relation.discovery",
  relationType: "relation_discovery",
  relationText: "",
  evidence: "none",
  confidence: 0,
  questionIntent: "relation_discovery"
};
const answers = answerSchemaFor(proposition);
const session: ConversationSession = {
  schemaVersion: 2,
  dialogueRevision: 3,
  id: "room_semantic_session",
  phase: "awaiting_answer",
  intent: "ask_relation",
  locationId: "room",
  templateIds: ["test_relation_discovery"],
  slotConceptIds: { person: adult.id, food: bonito.id },
  topicWordIds: proposition.wordIds,
  proposition,
  questionIntent: proposition.questionIntent,
  history: [],
  queuedTurns: [],
  pendingQuestion: {
    id: "question_relation_discovery",
    prompt: "「おとな」と「かつお節」には、何か関係がありますか？",
    choices: answers,
    answerSchema: answers,
    questionIntent: proposition.questionIntent,
    proposition
  },
  absurdityCount: 0,
  randomSeed: 7,
  validationErrors: [],
  startedAt: now,
  updatedAt: now
};

describe("MainRoom semantic answer controls", () => {
  it("keeps semantic answers re-selectable and navigation separate", async () => {
    serviceMocks.closeConversation.mockClear();
    serviceMocks.answerConversation.mockClear();
    const user = userEvent.setup();
    render(
      <MainRoom
        player={player}
        character={character}
        settings={settings}
        concepts={[adult, bonito]}
        sessions={[session]}
        newsItems={[]}
        saving={false}
        onNavigate={vi.fn()}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const related = screen.getByRole("button", { name: "関係がある" });
    const unrelated = screen.getByRole("button", { name: "関係はない" });
    expect(related.hasAttribute("disabled")).toBe(false);
    expect(unrelated.hasAttribute("disabled")).toBe(false);

    await user.click(related);
    expect(related.getAttribute("aria-pressed")).toBe("true");
    await user.click(unrelated);
    expect(unrelated.getAttribute("aria-pressed")).toBe("true");
    expect(related.getAttribute("aria-pressed")).toBe("false");

    await user.click(screen.getByRole("button", { name: "答えず話を閉じる" }));
    expect(serviceMocks.closeConversation).toHaveBeenCalledWith(session.id);
    expect(serviceMocks.answerConversation).not.toHaveBeenCalled();
  });
});
