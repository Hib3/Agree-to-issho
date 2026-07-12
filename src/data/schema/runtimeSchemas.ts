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

const dialogueChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  effect: z.enum(["affirm", "deny", "curious", "later"])
});

const dialogueTurnSchema = z.object({
  id: z.string().min(1),
  speaker: z.enum(["aguri", "player"]),
  page: z.string(),
  emotion: characterEmotionSchema,
  conceptIds: z.array(z.string()),
  choices: z.array(dialogueChoiceSchema).optional(),
  createdAt: z.number()
});

const pendingQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  choices: z.array(dialogueChoiceSchema).min(1),
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
  currentLocationId: z.string().min(1),
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
  id: z.string().min(1),
  phase: z.enum(["opening", "premise", "question", "awaiting_answer", "reaction", "twist", "closing", "completed"]),
  intent: z.enum(conversationIntents),
  locationId: z.string().min(1),
  templateIds: z.array(z.string()),
  slotConceptIds: z.record(z.string(), z.string()),
  history: z.array(dialogueTurnSchema),
  queuedTurns: z.array(dialogueTurnSchema),
  pendingQuestion: pendingQuestionSchema.optional(),
  absurdityCount: z.number().int().min(0).max(1),
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
  autonomousSpeech: z.boolean(),
  updatedAt: z.number()
});

export const dialogueTemplateSchema = z.object({
  id: z.string().min(1),
  semanticFrame: z.string().min(1),
  intent: z.enum(conversationIntents),
  phase: z.enum(["opening", "premise", "question", "awaiting_answer", "reaction", "twist", "closing", "completed"]),
  locations: z.array(z.string()).min(1),
  moods: z.array(z.string()).min(1),
  slots: z.array(z.object({ name: z.string(), categories: z.array(z.enum(conceptCategories)).min(1), grammaticalRole: z.enum(["subject", "object", "location", "action", "container", "body_part", "companion"]), required: z.boolean() })).min(1),
  constraints: z.object({ minUserWords: z.number().optional(), maxRecentUse: z.number().optional(), requiredRelations: z.array(z.enum(relationTypes)).optional(), forbiddenSameConcept: z.array(z.array(z.string())).optional() }),
  variants: z.array(z.string().min(1)).min(1),
  responsePatternIds: z.array(z.string()).optional(),
  cooldownSessions: z.number().int().min(1)
});

export const backupSchema = z
  .object({
    appId: z.literal("aguri-cleanroom"),
    schemaVersion: z.literal(1),
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
