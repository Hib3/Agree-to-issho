import type {
  CompositionProposition,
  ConversationSession,
  DialogueTurn
} from "../model/conversation";
import { CURRENT_DIALOGUE_REVISION } from "../model/conversation";

type LegacySession = Omit<Partial<ConversationSession>, "dialogueRevision"> & {
  dialogueRevision?: number;
  history?: Array<Partial<DialogueTurn>>;
  queuedTurns?: Array<Partial<DialogueTurn>>;
};

export function isCurrentConversationSession(session: ConversationSession) {
  const candidate = session as LegacySession;
  return candidate.schemaVersion === 2 && candidate.dialogueRevision === CURRENT_DIALOGUE_REVISION && Boolean(candidate.proposition) && Array.isArray(candidate.topicWordIds);
}

export function migrateConversationSession(
  session: ConversationSession,
  now = Date.now(),
  extraErrors: string[] = []
): ConversationSession {
  if (isCurrentConversationSession(session)) return session;
  const legacy = session as LegacySession;
  const slotIds = Object.values(legacy.slotConceptIds ?? {}).filter((id): id is string => typeof id === "string");
  const focusId = slotIds[0] ?? "legacy_unknown";
  const proposition: CompositionProposition = {
    wordIds: [focusId],
    frameId: "legacy.invalidated",
    relationType: "single_word",
    relationText: "",
    evidence: "none",
    confidence: 0,
    questionIntent: "none"
  };
  const templateId = legacy.templateIds?.[0] ?? "legacy";
  const migrateTurn = (turn: Partial<DialogueTurn>, index: number): DialogueTurn => {
    const page = typeof turn.page === "string" ? turn.page : "";
    const conceptIds = Array.isArray(turn.conceptIds) ? turn.conceptIds : [];
    return {
      id: typeof turn.id === "string" ? turn.id : "legacy_turn_" + index,
      speaker: turn.speaker === "player" ? "player" : "aguri",
      page,
      emotion: turn.emotion ?? "curious",
      conceptIds,
      requiresAnswer: false,
      answerSchema: [],
      semanticKey: "legacy.invalidated",
      templateId,
      usedWordIds: conceptIds,
      styleBasePage: page,
      styledPreview: page,
      validationErrors: ["legacy_turn"],
      createdAt: typeof turn.createdAt === "number" ? turn.createdAt : now + index
    };
  };

  return {
    schemaVersion: 2,
    dialogueRevision: CURRENT_DIALOGUE_REVISION,
    id: legacy.id ?? "legacy_session_" + crypto.randomUUID(),
    phase: "completed",
    intent: legacy.intent ?? "small_talk",
    locationId: legacy.locationId ?? "room",
    templateIds: legacy.templateIds ?? [templateId],
    slotConceptIds: legacy.slotConceptIds ?? { focus: focusId },
    topicWordIds: [focusId],
    proposition,
    questionIntent: "none",
    history: (legacy.history ?? []).map(migrateTurn),
    queuedTurns: [],
    absurdityCount: 0,
    randomSeed: 0,
    validationErrors: [...new Set(["legacy_session_invalidated", ...extraErrors])],
    startedAt: legacy.startedAt ?? now,
    updatedAt: now,
    completedAt: now
  };
}
