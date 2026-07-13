import { z } from "zod";
import { conceptCategories } from "../../domain/model/concept";
import { conversationIntents } from "../../domain/model/conversation";
import { relationTypes } from "../../domain/model/relation";

const grammarSchema = z.object({
  nounLike: z.boolean(),
  suruAction: z.boolean(),
  verbDictionaryForm: z.string().optional(),
  teForm: z.string().optional(),
  pastForm: z.string().optional(),
  negativeForm: z.string().optional(),
  potentialForm: z.string().optional(),
  canBeSubject: z.boolean(),
  canBeObject: z.boolean(),
  canBeLocation: z.boolean(),
  canBeContainer: z.boolean(),
  canBeCompanion: z.boolean(),
  canBePossessed: z.boolean()
});

const characterEmotionSchema = z.enum(["calm", "curious", "happy", "excited", "embarrassed", "confused", "lonely", "sleepy"]);
const questionIntentSchema = z.enum([
  "relation_discovery",
  "relation_confirmation",
  "category_confirmation",
  "attribute_confirmation",
  "situation_question",
  "preference_question",
  "correction_request",
  "conversation_navigation",
  "none"
]);
const answerEffectSchema = z.object({
  semanticEffect: z.enum(["confirm", "reject", "unknown", "preference_like", "preference_neutral", "preference_dislike", "none"]),
  navigationEffect: z.enum(["continue", "close", "stay", "none"]),
  memoryEffect: z.enum(["link_words", "unlink_words", "update_preference", "update_category", "update_attribute", "none"]),
  relationType: z.enum(relationTypes).optional(),
  relationDirection: z.enum(["forward", "reverse"]).optional()
});

const dialogueChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  effect: z.enum(["affirm", "deny", "curious", "later"]),
  answerEffect: answerEffectSchema.optional()
});

const dialogueTurnSchema = z.object({
  id: z.string().min(1),
  speaker: z.enum(["aguri", "player"]),
  page: z.string(),
  emotion: characterEmotionSchema,
  conceptIds: z.array(z.string()),
  choices: z.array(dialogueChoiceSchema).optional(),
  requiresAnswer: z.boolean().optional(),
  answerSchema: z.array(dialogueChoiceSchema).optional(),
  semanticKey: z.string().optional(),
  templateId: z.string().optional(),
  usedWordIds: z.array(z.string()).optional(),
  styleBasePage: z.string().optional(),
  styledPreview: z.string().optional(),
  validationErrors: z.array(z.string()).optional(),
  createdAt: z.number()
});

const propositionSchema = z.object({
  wordIds: z.array(z.string()),
  frameId: z.string(),
  relationType: z.enum(["confirmed_relation", "scene_hypothesis", "relation_discovery", "single_word", "drift_hypothesis"]),
  relationText: z.string(),
  evidence: z.enum(["confirmed_relation", "scene_frame", "category_only", "none"]),
  confidence: z.number(),
  questionIntent: questionIntentSchema,
  attributeClaim: z.object({
    conceptId: z.string().min(1),
    key: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    prompt: z.string().min(1),
    answerLabel: z.string().min(1)
  }).optional()
});

const pendingQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  choices: z.array(dialogueChoiceSchema).min(1),
  questionIntent: questionIntentSchema.optional(),
  answerSchema: z.array(dialogueChoiceSchema).optional(),
  proposition: propositionSchema.optional(),
  relationDraft: z.object({
    fromConceptId: z.string().min(1),
    toConceptId: z.string().min(1),
    type: z.string().min(1)
  }).optional()
});

export const conceptSchema = z.object({
  id: z.string().min(1),
  source: z.enum(["starter", "user"]),
  surface: z.string().min(1).max(24),
  normalized: z.string().min(1).max(24),
  reading: z.string().optional(),
  aliases: z.array(z.string()),
  userCategory: z.enum(conceptCategories),
  systemHintCategory: z.enum(conceptCategories).optional(),
  categoryConfidence: z.number().min(0).max(1),
  preference: z.union([z.literal(-2), z.literal(-1), z.literal(0), z.literal(1), z.literal(2)]).optional(),
  grammar: grammarSchema,
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  learnedAt: z.number(),
  lastReviewedAt: z.number().optional(),
  lastUsedAt: z.number().optional(),
  usageCount: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  understanding: z.number().min(0).max(1),
  ambiguity: z.number().min(0).max(1),
  active: z.boolean()
});

export const relationSchema = z.object({
  id: z.string().min(1),
  fromConceptId: z.string().min(1),
  toConceptId: z.string().min(1),
  type: z.enum(relationTypes),
  source: z.enum(["explicit", "answer", "story", "inferred"]),
  strength: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  createdAt: z.number(),
  reinforcedAt: z.number()
});

const playerSchema = z.object({
  id: z.literal("local"),
  name: z.string().min(1),
  callName: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number()
});

const characterSchema = z.object({
  id: z.literal("aguri"),
  name: z.string().min(1),
  emotion: characterEmotionSchema,
  energy: z.number(),
  closeness: z.number(),
  curiosity: z.number(),
  socialNeed: z.number(),
  trust: z.number(),
  boredom: z.number(),
  currentLocationId: z.enum(["room", "street", "rooftop"]),
  lastUserInteractionAt: z.number(),
  lastSpeechAt: z.number(),
  updatedAt: z.number()
});

const memorySchema = z.object({
  id: z.string().min(1),
  type: z.enum(["word_learned", "word_reviewed", "conversation", "outing", "rumor", "discovery", "warning", "meeting", "diary", "player_choice"]),
  conceptIds: z.array(z.string()),
  relationIds: z.array(z.string()),
  participantIds: z.array(z.string()),
  locationId: z.string().min(1),
  emotion: characterEmotionSchema,
  importance: z.number().min(0).max(1),
  createdAt: z.number(),
  lastRecalledAt: z.number().optional(),
  recallCount: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown())
});

const conversationSessionSchema = z.object({
  schemaVersion: z.literal(2).optional(),
  dialogueRevision: z.literal(2).optional(),
  id: z.string().min(1),
  phase: z.enum(["opening", "premise", "question", "awaiting_answer", "reaction", "twist", "closing", "completed"]),
  intent: z.enum(conversationIntents),
  locationId: z.string().min(1),
  templateIds: z.array(z.string()),
  slotConceptIds: z.record(z.string(), z.string()),
  topicWordIds: z.array(z.string()).optional(),
  proposition: propositionSchema.optional(),
  questionIntent: questionIntentSchema.optional(),
  history: z.array(dialogueTurnSchema),
  queuedTurns: z.array(dialogueTurnSchema),
  pendingQuestion: pendingQuestionSchema.optional(),
  absurdityCount: z.number().int().min(0).max(1),
  randomSeed: z.number().optional(),
  validationErrors: z.array(z.string()).optional(),
  startedAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional()
});

const dialogueHistorySchema = dialogueTurnSchema.extend({
  sessionId: z.string().min(1),
  intent: z.enum(conversationIntents),
  locationId: z.string().min(1)
});

const diarySchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  conceptIds: z.array(z.string()),
  memoryIds: z.array(z.string()),
  createdAt: z.number()
});

const settingsSchema = z.object({
  id: z.literal("local"),
  textSpeed: z.enum(["slow", "normal", "fast"]),
  fontScale: z.enum(["small", "normal", "large"]),
  highContrast: z.boolean(),
  reducedMotion: z.boolean(),
  volume: z.number(),
  muted: z.boolean(),
  audioRevision: z.literal(1).optional(),
  autonomousSpeech: z.boolean(),
  newsEnabled: z.boolean().optional(),
  newsRefreshMinutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(180)]).optional(),
  newsUseRss2Json: z.boolean().optional(),
  newsFeeds: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        url: z.string().url(),
        enabled: z.boolean(),
        addedAt: z.number(),
        lastCheckedAt: z.number().optional(),
        lastSuccessAt: z.number().optional(),
        lastError: z.string().optional()
      })
    )
    .optional(),
  updatedAt: z.number()
});

export const dialogueTemplateSchema = z.object({
  id: z.string().min(1),
  semanticFrame: z.string().min(1),
  grounding: z.enum(["scene_frame", "relation_required"]),
  intent: z.enum(conversationIntents),
  phase: z.enum(["opening", "premise", "question", "awaiting_answer", "reaction", "twist", "closing", "completed"]),
  locations: z.array(z.string()).min(1),
  moods: z.array(z.string()).min(1),
  slots: z.array(z.object({ name: z.string(), categories: z.array(z.enum(conceptCategories)).min(1), grammaticalRole: z.enum(["topic", "subject", "object", "location", "action", "container", "body_part", "companion"]), required: z.boolean() })).min(1),
  constraints: z.object({ minUserWords: z.number().optional(), maxRecentUse: z.number().optional(), requiredRelations: z.array(z.enum(relationTypes)).optional(), forbiddenSameConcept: z.array(z.array(z.string())).optional() }),
  variants: z.array(z.string().min(1)).min(1),
  responsePatternIds: z.array(z.string()).optional(),
  cooldownSessions: z.number().int().min(1)
});

export const backupSchema = z
  .object({
    appId: z.literal("aguri-cleanroom"),
    schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    buildId: z.string().optional(),
    exportedAt: z.number(),
    checksum: z.string(),
    player: playerSchema.nullable(),
    character: characterSchema.nullable(),
    concepts: z.array(conceptSchema),
    relations: z.array(relationSchema),
    memories: z.array(memorySchema),
    conversationSessions: z.array(conversationSessionSchema),
    dialogueHistory: z.array(dialogueHistorySchema),
    diaries: z.array(diarySchema),
    settings: settingsSchema.nullable()
  })
  .strict();
