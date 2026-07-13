import { createDebugLearnedConcepts } from "../src/data/debug/createDebugLearnedConcepts";
import { dialogueTemplates } from "../src/data/dialogue-templates/dialogueTemplates";
import { locations } from "../src/data/locations/locations";
import { responsePatterns } from "../src/data/response-patterns/responsePatterns";
import { validateConversationSession } from "../src/domain/conversation/dialogueValidator";
import { buildIntentBias } from "../src/domain/conversation/intentPolicy";
import { planConversation } from "../src/domain/conversation/planner";
import type { CharacterState } from "../src/domain/model/character";
import type { ConversationSession } from "../src/domain/model/conversation";
import { SeededRandom } from "../src/infrastructure/random/random";

const now = 1_700_000_000_000;
const concepts = createDebugLearnedConcepts(100, now);
const recentSessions: ConversationSession[] = [];
const transcripts = new Set<string>();
const samples: Array<{
  seed: number;
  intent: string;
  relationType: string;
  pages: string[];
  question: string | null;
}> = [];
const intentCounts: Record<string, number> = {};
const failures: string[] = [];
let multiPage = 0;
let narrative = 0;
let drift = 0;
let questions = 0;
let attributeGrounded = 0;

const character: CharacterState = {
  id: "aguri",
  name: "アグリちゃん",
  emotion: "curious",
  energy: 78,
  closeness: 35,
  curiosity: 0.82,
  socialNeed: 24,
  trust: 38,
  boredom: 26,
  currentLocationId: "room",
  lastUserInteractionAt: now,
  lastSpeechAt: now,
  updatedAt: now
};

for (let seed = 1; seed <= 1000; seed += 1) {
  const location = locations[seed % locations.length] ?? locations[0]!;
  const sessionNow = now + seed * 60_000;
  const session = planConversation({
    templates: dialogueTemplates,
    responsePatterns,
    concepts,
    relations: [],
    recentSessions,
    character: { ...character, currentLocationId: location.id },
    locationId: location.id,
    now: sessionNow,
    random: new SeededRandom(seed),
    randomSeed: seed,
    intentBias: buildIntentBias({ concepts, recentSessions, character, location, now: sessionNow })
  });
  const errors = [...validateConversationSession(session), ...session.validationErrors];
  if (errors.length > 0) failures.push(`${seed}:${errors.join(",")}`);
  const transcript = session.queuedTurns.map((turn) => turn.styledPreview).join("\n");
  transcripts.add(transcript);
  intentCounts[session.intent] = (intentCounts[session.intent] ?? 0) + 1;
  if (session.queuedTurns.length >= 3) multiPage += 1;
  if (["scene_hypothesis", "drift_hypothesis"].includes(session.proposition.relationType)) narrative += 1;
  if (session.proposition.relationType === "drift_hypothesis") drift += 1;
  if (session.pendingQuestion) questions += 1;
  if (session.queuedTurns.some((turn) => /教わって|教わりました/u.test(turn.page))) attributeGrounded += 1;
  if (samples.length < 5 && session.queuedTurns.length >= 3) {
    samples.push({
      seed,
      intent: session.intent,
      relationType: session.proposition.relationType,
      pages: session.queuedTurns.map((turn) => turn.styledPreview),
      question: session.pendingQuestion?.prompt ?? null
    });
  }
  recentSessions.push({ ...session, phase: "completed", completedAt: sessionNow });
  if (recentSessions.length > 24) recentSessions.shift();
}

if (failures.length > 0) throw new Error(`dialogue simulation failed: ${failures.slice(0, 10).join(" | ")}`);

console.log(
  JSON.stringify(
    {
      learnedWords: concepts.length,
      sessions: 1000,
      uniqueTranscripts: transcripts.size,
      multiPage,
      narrative,
      controlledDrift: drift,
      questions,
      attributeGrounded,
      intentCounts,
      samples
    },
    null,
    2
  )
);
