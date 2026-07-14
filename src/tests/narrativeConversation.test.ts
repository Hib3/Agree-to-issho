import { describe, expect, it } from "vitest";
import { dialogueTemplates } from "../data/dialogue-templates/dialogueTemplates";
import { createDebugLearnedConcepts } from "../data/debug/createDebugLearnedConcepts";
import { responsePatterns } from "../data/response-patterns/responsePatterns";
import { starterConcepts } from "../data/starter/starterConcepts";
import { planConversation } from "../domain/conversation/planner";
import { validateConversationSession } from "../domain/conversation/dialogueValidator";
import { outingOpening } from "../domain/conversation/narrativeGenerator";
import type { CharacterState } from "../domain/model/character";
import type { Concept } from "../domain/model/concept";
import type { ConversationSession } from "../domain/model/conversation";
import { SeededRandom } from "../infrastructure/random/random";

const now = 1_700_000_000_000;
const character: CharacterState = {
  id: "aguri",
  name: "アグリちゃん",
  emotion: "curious",
  energy: 78,
  closeness: 35,
  curiosity: 0.82,
  socialNeed: 24,
  trust: 38,
  boredom: 18,
  currentLocationId: "room",
  lastUserInteractionAt: now,
  lastSpeechAt: now,
  updatedAt: now
};

function makeOneHundredLearnedWords() {
  return createDebugLearnedConcepts(100, now);
}

describe("multi-page narrative conversation", () => {
  it("keeps action collocations natural in questions and story pages", () => {
    const concepts = makeOneHundredLearnedWords();
    const letter = concepts.find((concept) => concept.surface === "手紙")!;
    const template = dialogueTemplates.find(
      (entry) => entry.id === "dialogue_ask_meaning_action_small_goal"
    )!;
    const session = planConversation({
      templates: [template],
      responsePatterns,
      concepts: [letter],
      relations: [],
      recentSessions: [],
      character,
      locationId: template.locations[0] ?? "room",
      now,
      random: new SeededRandom(3),
      randomSeed: 3
    });
    const transcript = session.queuedTurns.map((turn) => turn.page).join("\n");

    expect(transcript).toContain("手紙を書く");
    expect(transcript).not.toMatch(/「手紙」を(?:する|して|始め)/u);
    expect(session.pendingQuestion?.prompt).toContain("『する』");
    expect(session.pendingQuestion?.prompt).not.toContain("「言葉の後ろに「する」");
  });

  it("uses category-appropriate case particles for outing openings", () => {
    const place = createDebugLearnedConcepts(1, now)[0]!;
    const shoppingStreet: Concept = { ...place, surface: "商店街", userCategory: "place" };
    const train: Concept = { ...place, id: "test-train", surface: "電車", userCategory: "vehicle" };

    expect(outingOpening(shoppingStreet, false)).toContain("「商店街」へ行く");
    expect(outingOpening(shoppingStreet, false)).not.toContain("を使った");
    expect(outingOpening(train, true)).toContain("「電車」に乗る");
  });

  it("runs 100 learned words through 1000 deterministic conversations", () => {
    const concepts = makeOneHundredLearnedWords();
    const recent: ConversationSession[] = [];
    const transcripts = new Set<string>();
    let narrativeCount = 0;
    let punchlineStoryCount = 0;
    let compactConversationCount = 0;
    let driftCount = 0;
    let maaOpeningCount = 0;
    const intentCounts = new Map<string, number>();
    const lenses = new Set<string>();
    const mechanisms = new Set<string>();
    const failures: string[] = [];

    for (let seed = 1; seed <= 1000; seed += 1) {
      const locationId = ["room", "street", "rooftop"][seed % 3] ?? "room";
      const session = planConversation({
        templates: dialogueTemplates,
        responsePatterns,
        concepts,
        relations: [],
        recentSessions: recent,
        character,
        locationId,
        now: now + seed,
        random: new SeededRandom(seed),
        randomSeed: seed
      });
      const transcript = session.queuedTurns.map((turn) => turn.styledPreview).join("\n");
      const errors = validateConversationSession(session);
      intentCounts.set(session.intent, (intentCounts.get(session.intent) ?? 0) + 1);

      if (errors.length > 0) failures.push(`${seed}:validation:${errors.join(",")}`);
      if (session.validationErrors.length > 0)
        failures.push(`${seed}:fallback:${session.validationErrors.join(",")}`);
      if (/まァっす|二つを比べてみたら|どんな一日になる|undefined|null|\[object Object\]/u.test(transcript)) {
        failures.push(`${seed}:broken-text`);
      }
      if (session.queuedTurns.some((turn) => turn.styledPreview.startsWith("まァっ、"))) maaOpeningCount += 1;
      if (["scene_hypothesis", "drift_hypothesis"].includes(session.proposition.relationType)) {
        narrativeCount += 1;
        if (session.queuedTurns.length < 3) failures.push(`${seed}:short-story`);
      }
      if (session.queuedTurns.length >= 5) punchlineStoryCount += 1;
      if (session.narrativePlan) {
        lenses.add(session.narrativePlan.lens);
        mechanisms.add(session.narrativePlan.mechanism);
        const beatKinds = session.narrativePlan.beats.map((beat) => beat.kind).join("|");
        if (beatKinds !== "premise|setup|development|turn|payoff") {
          failures.push(`${seed}:narrative-beat-order`);
        }
        if (
          session.narrativePlan.callbackConceptIds.some(
            (id) =>
              !session.narrativePlan!.beats[3].conceptIds.includes(id) ||
              !session.narrativePlan!.beats[4].conceptIds.includes(id)
          )
        ) {
          failures.push(`${seed}:narrative-callback-mismatch`);
        }
      }
      if (session.queuedTurns.length >= 2 && session.queuedTurns.length <= 4) compactConversationCount += 1;
      if (session.proposition.relationType === "drift_hypothesis") {
        driftCount += 1;
        if (session.absurdityCount !== 1 || session.questionIntent !== "correction_request")
          failures.push(`${seed}:uncontrolled-drift`);
      }
      if (session.pendingQuestion) {
        for (const conceptId of session.proposition.wordIds) {
          const surface = concepts.find((concept) => concept.id === conceptId)?.surface;
          if (surface && !session.pendingQuestion.prompt.includes(surface))
            failures.push(`${seed}:unnamed-question-target:${surface}`);
        }
      }

      transcripts.add(transcript);
      recent.push({ ...session, phase: "completed", completedAt: now + seed });
      if (recent.length > 24) recent.shift();
    }

    expect(failures).toEqual([]);
    expect(narrativeCount).toBeGreaterThan(500);
    expect(punchlineStoryCount).toBeGreaterThan(350);
    expect(compactConversationCount).toBeGreaterThan(120);
    expect(driftCount).toBeGreaterThan(10);
    expect(driftCount).toBeLessThan(130);
    expect(intentCounts.size).toBeGreaterThanOrEqual(10);
    expect(intentCounts.get("ask_meaning") ?? 0).toBeGreaterThan(10);
    expect(intentCounts.get("ask_preference") ?? 0).toBeGreaterThan(0);
    expect(intentCounts.get("ask_preference") ?? 0).toBeLessThan(80);
    expect(lenses.size).toBeGreaterThanOrEqual(4);
    expect(mechanisms.size).toBe(11);
    expect(transcripts.size).toBeGreaterThan(700);
    expect(maaOpeningCount).toBeLessThan(25);
  });

  it("keeps every generated frame within its declared semantic roles", () => {
    const concepts = starterConcepts.map(
      (concept, index) =>
        ({
          ...concept,
          id: `all_user_${index}`,
          source: "user" as const
        }) satisfies Concept
    );
    const failures: string[] = [];

    for (const [index, template] of dialogueTemplates.entries()) {
      if (
        template.grounding === "relation_required" &&
        !["ask_relation", "misunderstanding"].includes(template.intent)
      )
        continue;
      const locationId = template.locations[0] ?? "room";
      const session = planConversation({
        templates: [template],
        responsePatterns,
        concepts,
        relations: [],
        recentSessions: [],
        character,
        locationId,
        now: now + index,
        random: new SeededRandom(index + 1),
        randomSeed: index + 1
      });
      const transcript = session.queuedTurns.map((turn) => turn.page).join("\n");
      if (validateConversationSession(session).length > 0) failures.push(`${template.id}:invalid`);
      if (session.proposition.wordIds.some((id) => !session.topicWordIds.includes(id)))
        failures.push(`${template.id}:topic-mismatch`);
      if (
        template.slots.length >= 2 &&
        session.proposition.relationType !== "relation_discovery" &&
        session.queuedTurns.length < 3
      ) {
        failures.push(`${template.id}:missing-story-beat`);
      }
      if (template.intent === "comparison" && !/(比べ|違い)/u.test(transcript))
        failures.push(`${template.id}:not-comparison`);
    }

    expect(failures).toEqual([]);
  });
});
