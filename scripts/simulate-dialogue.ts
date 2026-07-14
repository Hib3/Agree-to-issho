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
const sessionCount = Math.max(1, Number(process.env.SIMULATION_SESSIONS ?? 10_000));
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
let punchlineStories = 0;
let compactConversations = 0;
const lensCounts: Record<string, number> = {};
const mechanismCounts: Record<string, number> = {};
let callbackMismatch = 0;
let missingNarrativeBeat = 0;
const malformedJapaneseCounts: Record<string, number> = {};

const malformedJapanesePatterns: Array<[string, RegExp]> = [
  ["nested_japanese_quote", /「[^」]*「/u],
  ["malformed_action_context", /ですること/u],
  ["broken_action_collocation", /「(?:手紙|写真|水やり|日記)」を(?:する|して|始める)/u],
  ["duplicate_particle", /(?:をを|がが|にはは|ではは)/u]
];

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

for (let seed = 1; seed <= sessionCount; seed += 1) {
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
  const japaneseAuditTarget = `${transcript}\n${session.pendingQuestion?.prompt ?? ""}`;
  for (const [code, pattern] of malformedJapanesePatterns) {
    if (!pattern.test(japaneseAuditTarget)) continue;
    malformedJapaneseCounts[code] = (malformedJapaneseCounts[code] ?? 0) + 1;
    failures.push(`${seed}:${code}`);
  }
  transcripts.add(transcript);
  intentCounts[session.intent] = (intentCounts[session.intent] ?? 0) + 1;
  if (session.queuedTurns.length >= 3) multiPage += 1;
  if (["scene_hypothesis", "drift_hypothesis"].includes(session.proposition.relationType)) narrative += 1;
  if (session.proposition.relationType === "drift_hypothesis") drift += 1;
  if (session.pendingQuestion) questions += 1;
  if (session.queuedTurns.some((turn) => /教わって|教わりました/u.test(turn.page))) attributeGrounded += 1;
  if (
    ["single_word", "scene_hypothesis"].includes(session.proposition.relationType) &&
    session.queuedTurns.length >= 5
  ) {
    punchlineStories += 1;
  }
  if (session.queuedTurns.length >= 2 && session.queuedTurns.length <= 4) compactConversations += 1;
  if (session.narrativePlan) {
    lensCounts[session.narrativePlan.lens] = (lensCounts[session.narrativePlan.lens] ?? 0) + 1;
    mechanismCounts[session.narrativePlan.mechanism] =
      (mechanismCounts[session.narrativePlan.mechanism] ?? 0) + 1;
    if (
      session.narrativePlan.beats.map((beat) => beat.kind).join("|") !==
      "premise|setup|development|turn|payoff"
    ) {
      missingNarrativeBeat += 1;
    }
    const callbackIds = session.narrativePlan.callbackConceptIds;
    if (
      callbackIds.some(
        (id) =>
          !session.narrativePlan!.beats[3].conceptIds.includes(id) ||
          !session.narrativePlan!.beats[4].conceptIds.includes(id)
      )
    ) {
      callbackMismatch += 1;
    }
  }
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

if (missingNarrativeBeat > 0 || callbackMismatch > 0) {
  failures.push(`narrative-structure:${missingNarrativeBeat}:${callbackMismatch}`);
}
if (failures.length > 0) throw new Error(`dialogue simulation failed: ${failures.slice(0, 10).join(" | ")}`);

console.log(
  JSON.stringify(
    {
      learnedWords: concepts.length,
      sessions: sessionCount,
      uniqueTranscripts: transcripts.size,
      multiPage,
      narrative,
      controlledDrift: drift,
      questions,
      attributeGrounded,
      punchlineStories,
      compactConversations,
      intentCounts,
      lensCounts,
      mechanismCounts,
      missingNarrativeBeat,
      callbackMismatch,
      malformedJapaneseCounts,
      samples
    },
    null,
    2
  )
);
