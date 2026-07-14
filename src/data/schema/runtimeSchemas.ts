import { z } from "zod";
import { conceptCategories } from "../../domain/model/concept";
import {
  conversationIntents,
  conversationLenses,
  punchlineMechanisms
} from "../../domain/model/conversation";
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

const lexicalProfileSchema = z.object({
  partOfSpeech: z.enum([
    "common_noun",
    "proper_noun",
    "verbal_noun",
    "verb",
    "i_adjective",
    "na_adjective",
    "expression",
    "unknown"
  ]),
  conjugation: z.enum(["godan", "ichidan", "suru", "kuru", "unknown"]).optional(),
  quotePolicy: z.enum(["mention_only", "allow_inflection"]),
  honorificPolicy: z.enum(["none", "person_only"]),
  confidence: z.number().min(0).max(1)
});

const characterEmotionSchema = z.enum([
  "calm",
  "curious",
  "happy",
  "excited",
  "embarrassed",
  "confused",
  "lonely",
  "sleepy"
]);
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
  semanticEffect: z.enum([
    "confirm",
    "reject",
    "unknown",
    "preference_like",
    "preference_neutral",
    "preference_dislike",
    "none"
  ]),
  navigationEffect: z.enum(["continue", "close", "stay", "none"]),
  memoryEffect: z.enum([
    "link_words",
    "unlink_words",
    "update_preference",
    "update_category",
    "update_attribute",
    "none"
  ]),
  relationType: z.enum(relationTypes).optional(),
  relationDirection: z.enum(["forward", "reverse"]).optional()
});

const dialogueChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  effect: z.enum(["affirm", "deny", "curious", "later"]),
  answerEffect: answerEffectSchema.optional(),
  newsResponseIntent: z
    .enum([
      "agree",
      "disagree",
      "interested",
      "not_interested",
      "concerned",
      "surprised",
      "personal_relevance",
      "correct_aguri",
      "ask_more",
      "close_topic"
    ])
    .optional()
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
  relationType: z.enum([
    "confirmed_relation",
    "scene_hypothesis",
    "relation_discovery",
    "single_word",
    "drift_hypothesis"
  ]),
  relationText: z.string(),
  evidence: z.enum(["confirmed_relation", "scene_frame", "category_only", "none"]),
  confidence: z.number(),
  questionIntent: questionIntentSchema,
  relationClaim: z
    .object({
      relationId: z.string().min(1),
      type: z.enum(relationTypes),
      fromConceptId: z.string().min(1),
      toConceptId: z.string().min(1)
    })
    .optional(),
  categoryClaim: z
    .object({
      conceptId: z.string().min(1),
      category: z.enum(conceptCategories),
      label: z.string().min(1)
    })
    .optional(),
  attributeClaim: z
    .object({
      conceptId: z.string().min(1),
      key: z.string().min(1),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      prompt: z.string().min(1),
      answerLabel: z.string().min(1)
    })
    .optional()
});

const narrativeBeatSchema = z.object({
  kind: z.enum(["premise", "setup", "development", "turn", "payoff"]),
  text: z.string().min(1),
  conceptIds: z.array(z.string()),
  grounding: z.enum(["confirmed_memory", "user_attribute", "scene_hypothesis", "imagination"])
});

const narrativePlanSchema = z.object({
  id: z.string().min(1),
  lens: z.enum(conversationLenses),
  mechanism: z.enum(punchlineMechanisms),
  focusConceptId: z.string().min(1),
  callbackConceptIds: z.array(z.string().min(1)).min(1),
  beats: z.tuple([
    narrativeBeatSchema,
    narrativeBeatSchema,
    narrativeBeatSchema,
    narrativeBeatSchema,
    narrativeBeatSchema
  ]),
  emotionalCurve: z.array(characterEmotionSchema).min(1),
  evidenceBoundary: z.enum(["memory", "typed_attribute", "hypothesis", "imagination"]),
  confidence: z.number().min(0).max(1),
  signature: z.string().min(1)
});

const pendingQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  choices: z.array(dialogueChoiceSchema).min(1),
  questionIntent: questionIntentSchema.optional(),
  answerSchema: z.array(dialogueChoiceSchema).optional(),
  proposition: propositionSchema.optional(),
  narrativePlan: narrativePlanSchema.optional(),
  relationDraft: z
    .object({
      fromConceptId: z.string().min(1),
      toConceptId: z.string().min(1),
      type: z.string().min(1)
    })
    .optional()
});

const articleContentLevelSchema = z.enum([
  "headline_only",
  "feed_summary",
  "feed_content",
  "article_extract"
]);

const articleDigestSchema = z.object({
  newsItemId: z.string().min(1),
  contentLevel: articleContentLevelSchema,
  sourceUrl: z.string().url(),
  extractedAt: z.number(),
  keyFacts: z.array(z.object({ id: z.string(), text: z.string(), evidenceId: z.string() })),
  keySentences: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      source: z.enum(["headline", "feed_summary", "feed_content", "article"])
    })
  ),
  entities: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["person", "place", "organization", "other"])
    })
  ),
  topics: z.array(z.object({ key: z.string(), label: z.string() })),
  events: z.array(z.object({ id: z.string(), description: z.string(), evidenceId: z.string() })),
  numericalFacts: z.array(z.object({ value: z.string(), context: z.string(), evidenceId: z.string() })),
  issues: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      summary: z.string(),
      evidenceIds: z.array(z.string()),
      kind: z.enum([
        "change",
        "cause",
        "effect",
        "benefit",
        "risk",
        "conflict",
        "number",
        "person",
        "place",
        "uncertainty"
      ]),
      importance: z.number(),
      relevanceToUser: z.number(),
      suitabilityForOpinion: z.number()
    })
  ),
  uncertainties: z.array(z.string()),
  tone: z.enum(["positive", "negative", "neutral", "mixed", "sensitive", "unknown"]),
  confidence: z.number().min(0).max(1)
});

const articleFetchTraceSchema = z.object({
  articleUrl: z.string().url(),
  startedAt: z.number(),
  attempts: z.array(
    z.object({
      method: z.enum(["feed_content", "direct_article", "reader_helper", "fallback_headline"]),
      startedAt: z.number(),
      finishedAt: z.number(),
      result: z.enum([
        "success",
        "cors_error",
        "http_error",
        "timeout",
        "parse_error",
        "too_short",
        "disabled"
      ]),
      statusCode: z.number().optional(),
      contentType: z.string().optional(),
      extractedCharacters: z.number().optional(),
      detail: z.string().optional()
    })
  ),
  finalContentLevel: articleContentLevelSchema
});

const characterOpinionSchema = z.object({
  id: z.string(),
  owner: z.enum(["user", "aguri"]),
  subjectConceptId: z.string().optional(),
  topicKey: z.string().optional(),
  polarity: z.number(),
  curiosity: z.number(),
  confidence: z.number(),
  reason: z.enum([
    "past_reaction",
    "category_tendency",
    "learned_attribute",
    "relationship",
    "current_emotion",
    "news_tone",
    "article_issue",
    "unknown"
  ]),
  createdAt: z.number(),
  updatedAt: z.number()
});

const newsResponseIntentSchema = z.enum([
  "agree",
  "disagree",
  "interested",
  "not_interested",
  "concerned",
  "surprised",
  "personal_relevance",
  "correct_aguri",
  "ask_more",
  "close_topic"
]);

const conversationOriginSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ordinary") }),
  z.object({
    type: z.literal("news"),
    newsItemId: z.string().min(1),
    articleDigest: articleDigestSchema,
    sourceUrl: z.string().url(),
    contentLevel: articleContentLevelSchema,
    fetchTrace: articleFetchTraceSchema,
    selectedIssueIds: z.array(z.string()),
    groundedFactIds: z.array(z.string()),
    conceptIds: z.array(z.string()),
    memoryIds: z.array(z.string()),
    discussionState: z.enum(["unread", "prepared", "discussing", "discussed", "dismissed"]),
    evolvingOpinion: z.object({
      initialOpinion: characterOpinionSchema,
      supportingFactIds: z.array(z.string()),
      uncertaintyIds: z.array(z.string()),
      userReaction: z
        .object({ intent: newsResponseIntentSchema, conceptIds: z.array(z.string()) })
        .optional(),
      revisedOpinion: characterOpinionSchema.optional(),
      revisionReason: z
        .enum([
          "user_agreement",
          "user_disagreement",
          "user_correction",
          "new_personal_connection",
          "unchanged"
        ])
        .optional()
    }),
    userReaction: z
      .object({
        intent: newsResponseIntentSchema,
        conceptIds: z.array(z.string()),
        recordedAt: z.number()
      })
      .optional(),
    startedAt: z.number(),
    completedAt: z.number().optional()
  })
]);

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
  lexicalProfile: lexicalProfileSchema.optional(),
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
  type: z.enum([
    "word_learned",
    "word_reviewed",
    "conversation",
    "outing",
    "rumor",
    "discovery",
    "warning",
    "meeting",
    "diary",
    "player_choice"
  ]),
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

const conversationSessionSchema = z
  .object({
    schemaVersion: z.literal(2).optional(),
    dialogueRevision: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    id: z.string().min(1),
    origin: conversationOriginSchema.optional(),
    phase: z.enum([
      "opening",
      "premise",
      "question",
      "awaiting_answer",
      "reaction",
      "twist",
      "closing",
      "completed"
    ]),
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
  })
  .superRefine((session, context) => {
    if (session.dialogueRevision !== 4 && session.dialogueRevision !== 5) return;
    const required = [
      [session.schemaVersion, "schemaVersion"],
      [session.topicWordIds, "topicWordIds"],
      [session.proposition, "proposition"],
      [session.questionIntent, "questionIntent"],
      [session.randomSeed, "randomSeed"],
      [session.validationErrors, "validationErrors"]
    ] as const;
    for (const [value, key] of required) {
      if (value === undefined)
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required for revision ${session.dialogueRevision}`
        });
    }
    if (session.dialogueRevision === 5 && session.origin === undefined) {
      context.addIssue({ code: "custom", path: ["origin"], message: "origin is required for revision 5" });
    }
    for (const [collectionName, turns] of [
      ["history", session.history],
      ["queuedTurns", session.queuedTurns]
    ] as const) {
      turns.forEach((turn, index) => {
        for (const key of [
          "requiresAnswer",
          "answerSchema",
          "semanticKey",
          "templateId",
          "usedWordIds",
          "styleBasePage",
          "styledPreview",
          "validationErrors"
        ] as const) {
          if (turn[key] === undefined)
            context.addIssue({
              code: "custom",
              path: [collectionName, index, key],
              message: `${key} is required for revision ${session.dialogueRevision}`
            });
        }
      });
    }
    if (session.pendingQuestion) {
      for (const key of ["questionIntent", "answerSchema", "proposition"] as const) {
        if (session.pendingQuestion[key] === undefined)
          context.addIssue({
            code: "custom",
            path: ["pendingQuestion", key],
            message: `${key} is required for revision ${session.dialogueRevision}`
          });
      }
    }
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
  newsUseFeedDiscoveryHelper: z.boolean().optional(),
  newsUseFeedFetchHelper: z.boolean().optional(),
  newsUseArticleHelper: z.boolean().optional(),
  // Kept only so version-one backups can be migrated without broadening consent.
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
  phase: z.enum([
    "opening",
    "premise",
    "question",
    "awaiting_answer",
    "reaction",
    "twist",
    "closing",
    "completed"
  ]),
  locations: z.array(z.string()).min(1),
  moods: z.array(z.string()).min(1),
  slots: z
    .array(
      z.object({
        name: z.string(),
        categories: z.array(z.enum(conceptCategories)).min(1),
        grammaticalRole: z.enum([
          "topic",
          "subject",
          "object",
          "location",
          "action",
          "container",
          "body_part",
          "companion"
        ]),
        required: z.boolean()
      })
    )
    .min(1),
  constraints: z.object({
    minUserWords: z.number().optional(),
    maxRecentUse: z.number().optional(),
    requiredRelations: z.array(z.enum(relationTypes)).optional(),
    forbiddenSameConcept: z.array(z.array(z.string())).optional()
  }),
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
