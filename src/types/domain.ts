export type Id = string;

export type WordCategory =
  | "person"
  | "place"
  | "food"
  | "object"
  | "action"
  | "feeling"
  | "time"
  | "idea"
  | "unknown";

export type EmotionTag =
  | "happy"
  | "sad"
  | "curious"
  | "lonely"
  | "sleepy"
  | "embarrassed"
  | "proud"
  | "neutral";

export type SituationTag =
  | "greeting"
  | "daily_talk"
  | "room"
  | "memory"
  | "question"
  | "diary"
  | "event"
  | "unknown";

export type CharacterExpression =
  | "idle_normal"
  | "idle_smile"
  | "idle_blink"
  | "talk_normal"
  | "talk_smile"
  | "happy"
  | "sad"
  | "surprised"
  | "angry"
  | "embarrassed"
  | "thinking"
  | "sleepy"
  | "lonely"
  | "confused"
  | "proud";

export type SpeechAct =
  | "greeting"
  | "ask_new_word"
  | "ask_category"
  | "ask_emotion"
  | "ask_situation"
  | "ask_relation"
  | "confirm_meaning"
  | "recall_word"
  | "use_word_in_daily_talk"
  | "diary_entry"
  | "misunderstanding_joke"
  | "ask_correction"
  | "praise_user"
  | "lonely_reaction"
  | "sleepy_reaction"
  | "happy_reaction"
  | "embarrassed_reaction"
  | "goodbye";

export type DriftLevel = 0 | 1 | 2 | 3;
export type EmotionCode =
  | "normal_talk"
  | "heart_warming"
  | "sad_awkward"
  | "surprised"
  | "inquisitive"
  | "sleepy"
  | "embarrassed"
  | "proud";

export type MotionHint = "none" | "bounce" | "shake" | "sway" | "sleepy" | "sparkle";

export type AppProfile = {
  id: "local";
  player_name: string;
  created_at: string;
  updated_at: string;
};

export type CharacterState = {
  id: "main";
  character_name: string;
  expression: CharacterExpression;
  affection: number;
  energy: number;
  last_interaction_at?: string;
  last_user_interaction_at?: string;
  last_character_speech_at?: string;
  idle_motion?: MotionHint;
  updated_at: string;
};

export type WordFrame = {
  id: Id;
  surface: string;
  reading: string;
  category: WordCategory;
  semantic_type: string;
  part_of_speech: "noun" | "verb" | "adjective" | "phrase" | "unknown";
  user_stance: "like" | "neutral" | "dislike" | "unknown";
  character_stance: "likes" | "curious" | "confused" | "avoids" | "unknown";
  emotion_tags: EmotionTag[];
  situation_tags: SituationTag[];
  relation_tags: string[];
  affordances: string[];
  related_word_ids: Id[];
  confidence: number;
  memory_strength: number;
  favorite_score: number;
  ambiguity_score: number;
  drift_level: DriftLevel;
  taught_by_user: boolean;
  source_question_ids: string[];
  use_count: number;
  review_count: number;
  correction_count: number;
  last_used_at?: string;
  last_reviewed_at?: string;
  last_context_used?: string;
  pronunciation_key?: string;
  forgotten_at?: string;
  created_at: string;
  updated_at: string;
  is_sensitive: boolean;
  is_blocked: boolean;
  notes: string;
};

export type WordRelation = {
  id: Id;
  from_word_id: Id;
  to_word_id: Id;
  relation_type: "similar" | "opposite" | "used_with" | "user_linked";
  confidence: number;
  created_at: string;
};

export type DialogueLog = {
  id: Id;
  session_id?: Id;
  role?: DialogueRole;
  speech_act?: SpeechAct;
  template_id?: string;
  semantic_key?: string;
  text: string;
  used_word_ids: Id[];
  reply_to_log_id?: Id;
  player_action?: string;
  selected_option_id?: string;
  emotion_code?: EmotionCode;
  motion_hint?: MotionHint;
  created_at: string;
};

export type DialogueRole = "character" | "player" | "system";

export type DialogueAnswerOption = {
  id: string;
  label: string;
  value: string;
};

export type ConversationPhase =
  | "opening"
  | "awaiting_answer"
  | "reaction"
  | "follow_up"
  | "closing"
  | "completed";

export type ConversationSession = {
  id: Id;
  intent: string;
  phase: ConversationPhase;
  topic_word_ids: Id[];
  prompt_log_id?: Id;
  question_kind?: "yes_no" | "single_choice" | "free_text" | "none";
  answer_options?: DialogueAnswerOption[];
  remaining_turns: number;
  answer_value?: string;
  answer_text?: string;
  queued_turns?: QueuedDialogueTurn[];
  started_at: string;
  updated_at: string;
  completed_at?: string;
};

export type QueuedDialogueTurn = {
  speech_act: SpeechAct;
  text: string;
  expression: CharacterExpression;
  emotion_code?: EmotionCode;
  motion_hint?: MotionHint;
  used_word_ids: Id[];
  template_id?: string;
  semantic_key?: string;
  requires_answer?: boolean;
  answer_schema?: DialogueTurn["answer_schema"];
};

export type DialogueSummary = {
  id: Id;
  summary: string;
  word_ids: Id[];
  created_at: string;
};

export type DiaryEntry = {
  id: Id;
  entry_date: string;
  title: string;
  body: string;
  used_word_ids: Id[];
  source_log_ids?: Id[];
  source_session_ids?: Id[];
  mood: EmotionTag;
  created_at: string;
};

export type EventFlag = {
  id: Id;
  key: string;
  value: boolean | number | string;
  updated_at: string;
};

export type GameSettings = {
  id: "local";
  reduce_motion: boolean;
  text_speed: "slow" | "normal" | "fast";
  autosave: boolean;
  auto_talk: boolean;
  debug_panel: boolean;
  updated_at: string;
};

export type ImportBackup = {
  id: Id;
  created_at: string;
  reason: string;
  data: ExportedSaveData;
};

export type AssetManifestItem = {
  id: string;
  expression: CharacterExpression;
  path: string;
  exists: boolean;
  status?: "approved" | "pending" | "rejected" | "missing";
  notes: string;
};

export type DialogueTemplate = {
  id: string;
  speech_act: SpeechAct;
  text: string;
  semantic_key?: string;
  intent?: "greeting" | "learning_prompt" | "memory_recall" | "daily_question" | "correction" | "praise" | "lonely" | "diary";
  word_slot?: {
    category?: WordCategory;
    situation?: SituationTag;
  };
  expression: CharacterExpression;
  motion_hint?: MotionHint;
  cooldown_group?: string;
  answer_schema?: DialogueTurn["answer_schema"];
};

export type DialogueTurn = {
  speech_act: SpeechAct;
  text: string;
  expression: CharacterExpression;
  emotion_code?: EmotionCode;
  motion_hint?: MotionHint;
  used_words: WordFrame[];
  template_id?: string;
  semantic_key?: string;
  session_id?: string;
  requires_answer?: boolean;
  answer_schema?: {
    kind: "yes_no" | "single_choice" | "free_text";
    options?: DialogueAnswerOption[];
    placeholder?: string;
    max_length?: number;
  };
  continuation?: QueuedDialogueTurn[];
  relaxed_constraints?: string[];
};

export type DialogueContext = {
  profile: AppProfile | null;
  character_state: CharacterState | null;
  words: WordFrame[];
  settings: GameSettings | null;
  dialogue_logs?: DialogueLog[];
  diary_entries?: DiaryEntry[];
  conversation_session?: ConversationSession | null;
  conversation_sessions?: ConversationSession[];
  now: string;
};

export type LearningQuestion = {
  id: string;
  speech_act: SpeechAct;
  prompt: string;
  field: "category" | "user_stance" | "situation_tags";
  options: Array<{ value: string; label: string }>;
};

export type PendingLearning = {
  draft_word_id: Id;
  question_ids: string[];
  current_question_id?: string;
};

export type ExportedSaveData = {
  schema_version: 1 | 2 | 3;
  app_id: "aguri-word-room" | "with-agree";
  exported_at: string;
  app_version: string;
  profile: AppProfile | null;
  character_state: CharacterState | null;
  words: WordFrame[];
  word_relations: WordRelation[];
  dialogue_logs: DialogueLog[];
  conversation_sessions: ConversationSession[];
  diary_entries: DiaryEntry[];
  dialogue_summaries: DialogueSummary[];
  event_flags: EventFlag[];
  settings: GameSettings | null;
  checksum: string;
};

export type ImportPreview = {
  valid: boolean;
  mode: "replace" | "merge";
  word_count: number;
  diary_count: number;
  conflict_surfaces: string[];
  errors: string[];
  data?: ExportedSaveData;
};

export type Screen =
  | "title"
  | "first-start"
  | "main-room"
  | "teach-word"
  | "wordbook"
  | "diary"
  | "settings"
  | "import-export"
  | "manual";
