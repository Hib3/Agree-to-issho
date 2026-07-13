import { conceptSchema, dialogueTemplateSchema } from "../src/data/schema/runtimeSchemas";
import { starterConcepts } from "../src/data/starter/starterConcepts";
import { dialogueTemplates } from "../src/data/dialogue-templates/dialogueTemplates";
import { learningPrompts } from "../src/data/learning-prompts/learningPrompts";
import { responsePatterns } from "../src/data/response-patterns/responsePatterns";
import { diaryTemplates } from "../src/data/diary-templates/diaryTemplates";
import { memoryCallbackTemplates } from "../src/data/dialogue-templates/memoryCallbackTemplates";
import { locations } from "../src/data/locations/locations";
import { onboardingScenarios } from "../src/data/initial/onboardingScenarios";

const minimums = {
  starterConcepts: 300,
  dialogueTemplates: 40,
  learningPrompts: 100,
  responsePatterns: 160,
  diaryTemplates: 60,
  memoryCallbackTemplates: 60,
  locations: 3,
  onboardingScenarios: 5
};

const datasets = {
  starterConcepts,
  dialogueTemplates,
  learningPrompts,
  responsePatterns,
  diaryTemplates,
  memoryCallbackTemplates,
  locations,
  onboardingScenarios
};

const errors: string[] = [];
for (const [name, minimum] of Object.entries(minimums)) {
  const count = datasets[name as keyof typeof datasets].length;
  if (count < minimum) errors.push(`${name}: ${count}/${minimum}`);
}

for (const [index, concept] of starterConcepts.entries()) {
  const parsed = conceptSchema.safeParse(concept);
  if (!parsed.success) errors.push(`starterConcepts[${index}]: ${parsed.error.issues[0]?.message ?? "invalid"}`);
}

const conceptIds = new Set<string>();
const surfaces = new Set<string>();
for (const concept of starterConcepts) {
  if (conceptIds.has(concept.id)) errors.push(`duplicate concept id: ${concept.id}`);
  if (surfaces.has(concept.normalized)) errors.push(`duplicate concept surface: ${concept.normalized}`);
  conceptIds.add(concept.id);
  surfaces.add(concept.normalized);
}

const responseIds = new Set(responsePatterns.map((pattern) => pattern.id));
const locationIds = new Set(locations.map((location) => location.id));
const templateIds = new Set<string>();
const semanticFrames = new Set<string>();
for (const [index, template] of dialogueTemplates.entries()) {
  const parsed = dialogueTemplateSchema.safeParse(template);
  if (!parsed.success) errors.push(`dialogueTemplates[${index}]: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  if (templateIds.has(template.id)) errors.push(`duplicate template id: ${template.id}`);
  if (semanticFrames.has(template.semanticFrame)) errors.push(`duplicate semantic frame: ${template.semanticFrame}`);
  templateIds.add(template.id);
  semanticFrames.add(template.semanticFrame);
  for (const location of template.locations) if (!locationIds.has(location as never)) errors.push(`${template.id}: unknown location ${location}`);
  for (const responseId of template.responsePatternIds ?? []) if (!responseIds.has(responseId)) errors.push(`${template.id}: unknown response ${responseId}`);
  const normalizedVariants = new Set<string>();
  for (const variant of template.variants) {
    const normalized = variant.replace(/\s/g, "");
    if (normalizedVariants.has(normalized)) errors.push(`${template.id}: duplicate dialogue text`);
    normalizedVariants.add(normalized);
    for (const slot of template.slots.filter((item) => item.required)) {
      const escapedName = slot.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`\\{${escapedName}(?::[^}]+)?\\}`).test(variant)) errors.push(`${template.id}: required slot ${slot.name} is unused`);
      if (!starterConcepts.some((concept) => slot.categories.includes(concept.userCategory))) errors.push(`${template.id}: no starter concept for ${slot.name}`);
    }
    if (Array.from(variant).length > 110) errors.push(`${template.id}: variant exceeds source limit`);
  }
}

const distributions = {
  people: starterConcepts.filter((concept) => ["person_descriptor", "occupation", "person_name", "famous_person"].includes(concept.userCategory)).length,
  places: starterConcepts.filter((concept) => concept.userCategory === "place").length,
  food: starterConcepts.filter((concept) => concept.userCategory === "food_drink").length,
  living: starterConcepts.filter((concept) => concept.userCategory === "living_thing").length,
  objects: starterConcepts.filter((concept) => concept.userCategory === "usable_object").length,
  wearable: starterConcepts.filter((concept) => concept.userCategory === "wearable").length,
  vehicles: starterConcepts.filter((concept) => concept.userCategory === "vehicle").length,
  actions: starterConcepts.filter((concept) => concept.userCategory === "action").length,
  abstract: starterConcepts.filter((concept) => concept.userCategory === "abstract").length,
  worksWords: starterConcepts.filter((concept) => ["music", "viewable", "readable", "word_expression"].includes(concept.userCategory)).length,
  body: starterConcepts.filter((concept) => concept.userCategory === "body_part").length,
  support: starterConcepts.filter((concept) => concept.userCategory === "other").length
};

const requiredDistribution = { people: 20, places: 30, food: 45, living: 20, objects: 45, wearable: 20, vehicles: 15, actions: 50, abstract: 30, worksWords: 15, body: 10, support: 20 };
for (const [name, minimum] of Object.entries(requiredDistribution)) {
  const actual = distributions[name as keyof typeof distributions];
  if (actual < minimum) errors.push(`distribution ${name}: ${actual}/${minimum}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({ counts: Object.fromEntries(Object.entries(datasets).map(([name, data]) => [name, data.length])), distributions }, null, 2));
