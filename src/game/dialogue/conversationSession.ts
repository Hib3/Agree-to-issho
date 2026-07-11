import type {
  ConversationSession,
  DialogueLog,
  DialogueTurn,
  SituationTag,
  WordFrame,
  WordRelation
} from "../../types/domain";

export type ConversationAnswerResult = {
  session: ConversationSession;
  turn: DialogueTurn;
  updated_words: WordFrame[];
  relation?: WordRelation;
};

export function createConversationSession(turn: DialogueTurn, now: string): ConversationSession {
  const queuedTurns = turn.continuation ?? [];
  const topicWordIds = Array.from(new Set([
    ...turn.used_words.map((word) => word.id),
    ...queuedTurns.flatMap((queued) => queued.used_word_ids)
  ]));
  return {
    id: turn.session_id ?? `session_${crypto.randomUUID()}`,
    intent: turn.semantic_key ?? "daily.conversation",
    phase: turn.requires_answer ? "awaiting_answer" : queuedTurns.length > 0 ? "follow_up" : "closing",
    topic_word_ids: topicWordIds,
    question_kind: turn.answer_schema?.kind ?? "none",
    ...(turn.answer_schema?.options ? { answer_options: turn.answer_schema.options } : {}),
    ...(queuedTurns.length > 0 ? { queued_turns: queuedTurns } : {}),
    remaining_turns: turn.requires_answer ? 2 : Math.max(1, queuedTurns.length),
    started_at: now,
    updated_at: now
  };
}

export function advanceConversation(session: ConversationSession, words: WordFrame[], now: string) {
  const [queued, ...remaining] = session.queued_turns ?? [];
  if (!queued) return null;
  const nextPhase = queued.requires_answer ? "awaiting_answer" : remaining.length > 0 ? "follow_up" : "closing";
  const nextSession: ConversationSession = {
    ...session,
    phase: nextPhase,
    question_kind: queued.answer_schema?.kind ?? "none",
    ...(queued.answer_schema?.options ? { answer_options: queued.answer_schema.options } : {}),
    queued_turns: remaining,
    remaining_turns: remaining.length + (queued.requires_answer ? 1 : 0),
    updated_at: now
  };
  const turn: DialogueTurn = {
    speech_act: queued.speech_act,
    text: queued.text,
    expression: queued.expression,
    emotion_code: queued.emotion_code,
    motion_hint: queued.motion_hint,
    used_words: queued.used_word_ids.map((id) => words.find((word) => word.id === id)).filter(Boolean) as WordFrame[],
    template_id: queued.template_id,
    semantic_key: queued.semantic_key,
    session_id: session.id,
    requires_answer: Boolean(queued.requires_answer),
    ...(queued.answer_schema ? { answer_schema: queued.answer_schema } : {})
  };
  return { session: nextSession, turn };
}

export function answerConversation(
  session: ConversationSession,
  answer: string,
  words: WordFrame[],
  now: string,
  freeText = ""
): ConversationAnswerResult {
  if (session.phase !== "awaiting_answer") throw new Error("この質問は回答待ちではありません。");
  const target = words.find((word) => word.id === session.topic_word_ids[0]);
  const related = words.find((word) => word.id === session.topic_word_ids[1]);
  const updatedWords: WordFrame[] = [];
  let relation: WordRelation | undefined;
  if (session.intent.startsWith("composition.") && target) {
    const topicWords = session.topic_word_ids
      .map((id) => words.find((word) => word.id === id))
      .filter(Boolean) as WordFrame[];
    for (const word of topicWords) {
      const otherIds = topicWords.filter((item) => item.id !== word.id).map((item) => item.id);
      updatedWords.push({
        ...word,
        related_word_ids: answer === "confirm"
          ? Array.from(new Set([...word.related_word_ids, ...otherIds]))
          : word.related_word_ids.filter((id) => !otherIds.includes(id)),
        review_count: word.review_count + 1,
        correction_count: word.correction_count + (answer === "correct" ? 1 : 0),
        ambiguity_score: clamp01(word.ambiguity_score - (answer === "confirm" || answer === "correct" ? 0.05 : 0)),
        confidence: clamp01(word.confidence + (answer === "confirm" ? 0.05 : 0.02)),
        source_question_ids: Array.from(new Set([...word.source_question_ids, answer === "confirm" ? "composition_relation_confirmed" : "composition_relation_corrected"])),
        last_reviewed_at: now,
        updated_at: now
      });
    }
    if (answer === "confirm" && topicWords[1]) {
      relation = {
        id: `relation_${target.id}_${topicWords[1].id}`,
        from_word_id: target.id,
        to_word_id: topicWords[1].id,
        relation_type: "user_linked",
        confidence: 0.9,
        created_at: now
      };
    }
  } else if (target) {
    const update = updateWordFromAnswer(target, session.intent, answer, freeText, now);
    updatedWords.push(update);
    if (session.intent.startsWith("relation.") && answer === "related" && related) {
      relation = {
        id: `relation_${target.id}_${related.id}`,
        from_word_id: target.id,
        to_word_id: related.id,
        relation_type: "user_linked",
        confidence: 0.9,
        created_at: now
      };
      updatedWords[0] = { ...update, related_word_ids: Array.from(new Set([...update.related_word_ids, related.id])) };
    }
  }

  const text = reactionText(target?.surface ?? "その言葉", answer, session.intent);
  const compositionAnswer = session.intent.startsWith("composition.");
  return {
    session: {
      ...session,
      phase: "reaction",
      answer_value: answer,
      ...(freeText.trim() ? { answer_text: freeText.trim().slice(0, 60) } : {}),
      remaining_turns: 1,
      updated_at: now
    },
    turn: {
      speech_act: answer === "correct" && !compositionAnswer ? "ask_correction" : "praise_user",
      text,
      expression: answer === "correct" && !compositionAnswer ? "thinking" : "talk_smile",
      emotion_code: answer === "correct" && !compositionAnswer ? "inquisitive" : "heart_warming",
      motion_hint: answer === "correct" && !compositionAnswer ? "sway" : "bounce",
      used_words: target ? [updatedWords[0] ?? target] : [],
      template_id: `reaction_${answer}`,
      semantic_key: `${session.intent}.reaction`,
      session_id: session.id,
      requires_answer: false
    },
    updated_words: updatedWords,
    ...(relation ? { relation } : {})
  };
}

export function createPlayerAnswerLog(session: ConversationSession, value: string, freeText: string, now: string): DialogueLog {
  return {
    id: `log_${crypto.randomUUID()}`,
    session_id: session.id,
    role: "player",
    text: freeText.trim().slice(0, 60) || session.answer_options?.find((option) => option.value === value)?.label || "回答",
    used_word_ids: session.topic_word_ids,
    ...(session.prompt_log_id ? { reply_to_log_id: session.prompt_log_id } : {}),
    player_action: session.question_kind ?? "answer",
    selected_option_id: value,
    created_at: now
  };
}

export function closeConversation(session: ConversationSession, word: WordFrame | undefined, now: string) {
  const closing: ConversationSession = {
    ...session,
    phase: "closing",
    remaining_turns: 0,
    updated_at: now
  };
  const wordText = word ? `「${word.surface}」のこと、また思い出したら話そうね。` : "答えてくれてありがとう。また続きを話そうね。";
  const turn: DialogueTurn = {
    speech_act: "praise_user",
    text: wordText,
    expression: "talk_smile",
    emotion_code: "heart_warming",
    motion_hint: "sway",
    used_words: word ? [word] : [],
    template_id: "session_closing_thanks",
    semantic_key: "session.closing.thanks",
    session_id: session.id,
    requires_answer: false
  };
  return { session: closing, turn };
}

export function completeConversation(session: ConversationSession, now: string): ConversationSession {
  return { ...session, phase: "completed", remaining_turns: 0, updated_at: now, completed_at: now };
}

function updateWordFromAnswer(word: WordFrame, intent: string, answer: string, freeText: string, now: string): WordFrame {
  const base = {
    ...word,
    review_count: word.review_count + 1,
    last_reviewed_at: now,
    updated_at: now
  };
  if (intent.includes("preference")) {
    const stance = answer === "like" || answer === "neutral" || answer === "dislike" ? answer : "unknown";
    const emotion = stance === "like" ? "happy" : stance === "dislike" ? "sad" : "neutral";
    return {
      ...base,
      user_stance: stance,
      emotion_tags: Array.from(new Set([emotion, ...word.emotion_tags])).slice(0, 3) as WordFrame["emotion_tags"],
      confidence: clamp01(word.confidence + (stance === "unknown" ? 0 : 0.08)),
      memory_strength: clamp01(word.memory_strength + 0.05)
    };
  }
  if (intent.includes("situation")) {
    const knownTags: SituationTag[] = ["room", "daily_talk", "memory", "question", "diary", "event", "unknown", "greeting"];
    const tag = knownTags.includes(answer as SituationTag) ? answer as SituationTag : null;
    const safeNote = freeText.replace(/[<>]/g, "").trim().slice(0, 60);
    return {
      ...base,
      situation_tags: tag ? Array.from(new Set([tag, ...word.situation_tags.filter((item) => item !== "unknown")])) : word.situation_tags,
      notes: safeNote ? [word.notes, `場面メモ: ${safeNote}`].filter(Boolean).join("\n") : word.notes,
      confidence: clamp01(word.confidence + (tag || safeNote ? 0.06 : 0)),
      memory_strength: clamp01(word.memory_strength + 0.04)
    };
  }
  if (intent.startsWith("review.")) {
    if (answer === "confirm") return { ...base, confidence: clamp01(word.confidence + 0.1), memory_strength: clamp01(word.memory_strength + 0.08), ambiguity_score: clamp01(word.ambiguity_score - 0.08) };
    if (answer === "correct") return { ...base, correction_count: word.correction_count + 1, confidence: clamp01(word.confidence - 0.04), ambiguity_score: clamp01(word.ambiguity_score + 0.08) };
  }
  return { ...base, memory_strength: clamp01(word.memory_strength + 0.02) };
}

function reactionText(surface: string, answer: string, intent: string) {
  if (intent.startsWith("composition.")) {
    if (answer === "confirm") return `やっぱり「${surface}」から始まるつながりで合ってたんですね。ノートの線を濃くしておきますっ！`;
    if (answer === "correct") return `まァっ、そこがずれてたんですね！「${surface}」たちは、いったん別々の線に戻して覚え直しますっ！`;
  }
  if (answer === "later" || answer === "unknown") return `「${surface}」は、まだ決めなくて大丈夫です。ノートには空きを残しておきますね。`;
  if (answer === "correct") return `なるほど、「${surface}」の覚え方は違っていたんですね。単語帳で直せるようにしておきます。`;
  if (answer === "confirm") return `よかった。「${surface}」は今の覚え方を少し強くしておきますね。`;
  if (answer === "related") return `つながっているんですね。二つの言葉を、近くにメモしておきますっ！`;
  if (answer === "unrelated") return `別々の言葉なんですね。混ぜないように覚えておきます。`;
  if (intent.includes("preference")) {
    if (answer === "like") return `「${surface}」は好きな方なんですね。うれしい印をつけておきますっ！`;
    if (answer === "dislike") return `「${surface}」は少し苦手なんですね。無理に明るく使わないようにします。`;
    return `「${surface}」はふつうの距離なんですね。落ち着いた印にしておきます。`;
  }
  return `教えてくれてありがとう。「${surface}」の輪郭が、さっきより見えてきました。`;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
