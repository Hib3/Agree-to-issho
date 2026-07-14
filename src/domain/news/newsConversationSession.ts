import type { CharacterState } from "../model/character";
import type {
  CompositionProposition,
  ConversationSession,
  DialogueChoice,
  DialogueTurn,
  PendingQuestion
} from "../model/conversation";
import { CURRENT_DIALOGUE_REVISION } from "../model/conversation";
import type {
  ArticleContentLevel,
  ArticleDigest,
  ArticleFetchTrace,
  CharacterOpinion,
  NewsConversationPlan,
  NewsItem,
  NewsResponseIntent
} from "../model/news";
import type { PlayerProfile } from "../model/player";
import { applyAguriVoice } from "../voice/aguriVoice";

export function createNewsConversationSession(input: {
  item: NewsItem;
  digest: ArticleDigest;
  plan: NewsConversationPlan;
  character: CharacterState;
  player: PlayerProfile;
  now: number;
  fetchTrace: ArticleFetchTrace;
}): ConversationSession {
  const { item, digest, plan, character, now, fetchTrace } = input;
  const proposition: CompositionProposition = {
    wordIds: plan.conceptIds,
    frameId: "news.discussion",
    relationType: "single_word",
    relationText: "",
    evidence: "none",
    confidence: digest.confidence,
    questionIntent: "conversation_navigation"
  };
  const choices = plan.responseQuestion.options.map(newsChoice);
  const prompt = plan.responseQuestion.prompt;
  const pendingQuestion: PendingQuestion = {
    id: `news_question_${item.id}`,
    prompt,
    choices,
    questionIntent: "conversation_navigation",
    answerSchema: choices,
    proposition
  };
  const initialOpinion =
    plan.opinions.find((opinion) => opinion.owner === "aguri") ?? fallbackOpinion(item.id, character, now);

  return {
    schemaVersion: 2,
    dialogueRevision: CURRENT_DIALOGUE_REVISION,
    origin: {
      type: "news",
      newsItemId: item.id,
      articleDigest: compactDigest(digest),
      sourceUrl: digest.sourceUrl,
      contentLevel: digest.contentLevel,
      fetchTrace,
      selectedIssueIds: plan.selectedIssueIds,
      groundedFactIds: plan.groundedFactIds,
      conceptIds: plan.conceptIds,
      memoryIds:
        plan.memoryConnection?.evidenceIds
          .filter((id) => id.startsWith("memory:"))
          .map((id) => id.slice("memory:".length)) ?? [],
      discussionState: "discussing",
      evolvingOpinion: {
        initialOpinion,
        supportingFactIds: plan.groundedFactIds.filter((factId) =>
          digest.issues
            .filter((issue) => plan.selectedIssueIds.includes(issue.id))
            .some((issue) => issue.evidenceIds.includes(factId))
        ),
        uncertaintyIds: digest.uncertainties.map((_, index) => `${item.id}_uncertainty_${index}`)
      },
      startedAt: now
    },
    id: `news_session_${item.id}_${now}`,
    phase: "opening",
    intent: "observation",
    locationId: character.currentLocationId,
    templateIds: plan.pages.map((page) => `news.${page.kind}`),
    slotConceptIds: Object.fromEntries(plan.conceptIds.map((id, index) => [`newsConcept${index}`, id])),
    topicWordIds: plan.conceptIds,
    proposition,
    questionIntent: "conversation_navigation",
    history: [],
    queuedTurns: plan.pages.map((page, index) => newsBeatTurn(page, proposition, now + index)),
    pendingQuestion,
    absurdityCount: 0,
    randomSeed: hash(`${item.id}:${now}`),
    validationErrors: [],
    startedAt: now,
    updatedAt: now
  };
}

export function applyNewsConversationResponse(
  session: ConversationSession,
  choice: DialogueChoice,
  now: number
): ConversationSession {
  if (session.origin.type !== "news" || !choice.newsResponseIntent) {
    throw new Error("ニュースへの返事として扱えません。");
  }
  const intent = choice.newsResponseIntent;
  const origin = session.origin;
  const initial = origin.evolvingOpinion.initialOpinion;
  const revised = reviseOpinion(initial, intent, now);
  const turn = responseTurn(session, intent, now);
  const { pendingQuestion, ...withoutQuestion } = session;
  void pendingQuestion;
  return {
    ...withoutQuestion,
    origin: {
      ...origin,
      userReaction: { intent, conceptIds: origin.conceptIds, recordedAt: now },
      evolvingOpinion: {
        ...origin.evolvingOpinion,
        userReaction: { intent, conceptIds: origin.conceptIds },
        revisedOpinion: revised,
        revisionReason: revisionReason(intent)
      }
    },
    phase: "reaction",
    questionIntent: "none",
    proposition: { ...session.proposition, questionIntent: "none" },
    queuedTurns: [turn],
    updatedAt: now
  };
}

function newsBeatTurn(
  page: NewsConversationPlan["pages"][number],
  proposition: CompositionProposition,
  now: number
): DialogueTurn {
  const styled = applyAguriVoice(page.text, page.emotion);
  return {
    id: `news_turn_${page.id}`,
    speaker: "aguri",
    page: page.text,
    emotion: page.emotion,
    conceptIds: proposition.wordIds,
    requiresAnswer: false,
    answerSchema: [],
    semanticKey: `news.${page.kind}`,
    templateId: `news.${page.kind}`,
    usedWordIds: proposition.wordIds,
    styleBasePage: page.text,
    styledPreview: styled,
    validationErrors: [],
    createdAt: now
  };
}

function responseTurn(session: ConversationSession, intent: NewsResponseIntent, now: number): DialogueTurn {
  if (session.origin.type !== "news") throw new Error("ニュース会話ではありません。");
  const digest = session.origin.articleDigest;
  const issue = digest.issues.find(
    (entry) => session.origin.type === "news" && session.origin.selectedIssueIds.includes(entry.id)
  );
  const fact = digest.keyFacts.find(
    (entry) => session.origin.type === "news" && session.origin.groundedFactIds.includes(entry.id)
  );
  const subject = issue?.summary ?? fact?.text ?? `「${digest.keySentences[0]?.text ?? "届いた見出し"}」`;
  const uncertainty = digest.uncertainties[0] ?? "記事の背景";
  const base = responseText(intent, subject, uncertainty, digest.contentLevel);
  const emotion = responseEmotion(intent);
  const styled = applyAguriVoice(base, emotion);
  return {
    id: `news_response_${session.id}_${now}`,
    speaker: "aguri",
    page: base,
    emotion,
    conceptIds: session.origin.conceptIds,
    requiresAnswer: false,
    answerSchema: [],
    semanticKey: `news.response.${intent}`,
    templateId: `news.response.${intent}`,
    usedWordIds: session.origin.conceptIds,
    styleBasePage: base,
    styledPreview: styled,
    validationErrors: [],
    createdAt: now
  };
}

function responseText(
  intent: NewsResponseIntent,
  subject: string,
  uncertainty: string,
  contentLevel: ArticleContentLevel
) {
  const headlineOnly = contentLevel === "headline_only";
  const lines: Record<NewsResponseIntent, string> = {
    agree: `見方が近いんですね。アグリも「${subject}」は気になります。でも、${uncertainty}はまだ決めつけません。`,
    disagree: `受け取り方が違うんですね。アグリは「${subject}」がまだ気になりますが、あなたの考えまでアグリと同じにはしません。`,
    interested: headlineOnly
      ? `見出しの言葉から考えてみます。ただ、本文を読めていないので、起きたことまでは作りません。`
      : `もっと知りたいんですね。アグリも「${subject}」の続きと、${uncertainty}を確かめたいです。`,
    not_interested: `今は遠い話なんですね。アグリは「${subject}」をメモに残しますが、ここで無理に引っぱりません。`,
    concerned: `心配になりますよね。アグリも「${subject}」を軽く扱わず、${uncertainty}が分からないまま安心だとは言いません。`,
    surprised: `数字や規模が大きく見えたんですね。アグリも「${subject}」が何と比べて大きいのか、もう少し確かめたいです。`,
    personal_relevance: `あなたの生活にも関係しそうなんですね。それは記事の新しい事実ではなく、あなたの受け取り方として覚えておきます。`,
    correct_aguri: `アグリの受け取り方に直したい所があるんですね。訂正内容を記事の事実に混ぜず、直してほしいという印だけ残します。`,
    ask_more: headlineOnly
      ? `今読めたのは見出しだけです。詳しい理由や結果は、元の記事を開かないと分かりません。`
      : `もう少し確かめたいんですね。「${subject}」以外に、${uncertainty}が分かる情報を探したいです。`,
    close_topic: `分かりました。この話はここで閉じます。読めた範囲と、分からなかった所を混ぜずにしまっておきます。`
  };
  return lines[intent];
}

function newsChoice(option: NewsConversationPlan["responseQuestion"]["options"][number]): DialogueChoice {
  return {
    id: `news_choice_${option.intent}`,
    label: option.label,
    effect: choiceEffect(option.intent),
    newsResponseIntent: option.intent,
    answerEffect: {
      semanticEffect: "none",
      navigationEffect: option.intent === "close_topic" ? "close" : "continue",
      memoryEffect: "none"
    }
  };
}

function choiceEffect(intent: NewsResponseIntent): DialogueChoice["effect"] {
  if (["agree", "personal_relevance"].includes(intent)) return "affirm";
  if (["disagree", "correct_aguri"].includes(intent)) return "deny";
  if (["not_interested", "close_topic"].includes(intent)) return "later";
  return "curious";
}

function reviseOpinion(initial: CharacterOpinion, intent: NewsResponseIntent, now: number): CharacterOpinion {
  const polarityDelta: Record<NewsResponseIntent, number> = {
    agree: initial.polarity === 0 ? 0.1 : Math.sign(initial.polarity) * 0.05,
    disagree: 0,
    interested: 0,
    not_interested: 0,
    concerned: -0.15,
    surprised: 0,
    personal_relevance: 0,
    correct_aguri: 0,
    ask_more: 0,
    close_topic: 0
  };
  const curiosityDelta = ["interested", "surprised", "ask_more", "personal_relevance"].includes(intent)
    ? 0.15
    : intent === "not_interested" || intent === "close_topic"
      ? -0.05
      : 0;
  return {
    ...initial,
    id: `${initial.id}_revised_${now}`,
    polarity: clamp(initial.polarity + polarityDelta[intent], -1, 1),
    curiosity: clamp(initial.curiosity + curiosityDelta, 0, 1),
    confidence: clamp(initial.confidence + (intent === "correct_aguri" ? -0.2 : 0), 0.1, 0.9),
    updatedAt: now
  };
}

function revisionReason(intent: NewsResponseIntent) {
  if (intent === "agree") return "user_agreement" as const;
  if (intent === "disagree") return "user_disagreement" as const;
  if (intent === "correct_aguri") return "user_correction" as const;
  if (intent === "personal_relevance") return "new_personal_connection" as const;
  return "unchanged" as const;
}

function responseEmotion(intent: NewsResponseIntent): CharacterState["emotion"] {
  if (["concerned", "close_topic", "not_interested"].includes(intent)) return "calm";
  if (intent === "correct_aguri" || intent === "disagree") return "confused";
  if (intent === "surprised") return "excited";
  if (intent === "agree" || intent === "personal_relevance") return "happy";
  return "curious";
}

function compactDigest(digest: ArticleDigest): ArticleDigest {
  return {
    ...digest,
    keySentences: digest.keySentences.slice(0, 8).map((entry) => ({
      ...entry,
      text: entry.text.slice(0, 320)
    })),
    keyFacts: digest.keyFacts.slice(0, 8).map((fact) => ({ ...fact, text: fact.text.slice(0, 320) })),
    issues: digest.issues.slice(0, 6).map((issue) => ({ ...issue, summary: issue.summary.slice(0, 320) }))
  };
}

function fallbackOpinion(itemId: string, character: CharacterState, now: number): CharacterOpinion {
  return {
    id: `${itemId}_aguri_unknown`,
    owner: "aguri",
    topicKey: "general",
    polarity: 0,
    curiosity: clamp(character.curiosity, 0.2, 1),
    confidence: 0.25,
    reason: "unknown",
    createdAt: now,
    updatedAt: now
  };
}

function hash(value: string) {
  return Array.from(value).reduce((result, character) => (result * 31 + character.charCodeAt(0)) >>> 0, 7);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
