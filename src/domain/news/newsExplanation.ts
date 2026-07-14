import type { CharacterState } from "../model/character";
import type { Concept } from "../model/concept";
import type { MemoryEvent } from "../model/memory";
import type {
  ArticleDigest,
  CharacterOpinion,
  NewsBeat,
  NewsConversationLens,
  NewsConversationPlan,
  NewsItem,
  NewsResponseIntent
} from "../model/news";
import type { ConceptRelation } from "../model/relation";
import { displayConcept } from "../grammar/japaneseRealizer";
import {
  buildNewsDiscourseFrame,
  realizeNewsImagination,
  realizeHeadlineUnderstanding,
  realizeNewsInterpretation,
  realizeNewsOpening,
  realizeNewsOpinion,
  realizeNewsUnderstanding,
  realizeNewsUncertainty,
  type NewsDiscourseFrame
} from "./newsJapaneseNlg";

type NewsContext = {
  character?: CharacterState | undefined;
  relations?: ConceptRelation[] | undefined;
  memories?: MemoryEvent[] | undefined;
  now?: number | undefined;
};

export function buildNewsConversationPlan(
  item: NewsItem,
  digest: ArticleDigest,
  concepts: Concept[],
  context: NewsContext = {}
): NewsConversationPlan {
  const sensitive = digest.tone === "sensitive";
  const directMatches = findNewsConcepts(item, digest, concepts);
  const lens = selectLens(digest, directMatches, context.character);
  const selectedIssues = selectIssues(
    digest,
    lens,
    directMatches,
    context.relations ?? [],
    context.memories ?? []
  );
  const discourse = buildNewsDiscourseFrame(item, digest, selectedIssues);
  const baseEmotion: NewsBeat["emotion"] = sensitive
    ? "calm"
    : digest.tone === "positive"
      ? "happy"
      : "curious";
  const openingReaction = beat(item, "opening", "headline", baseEmotion, realizeNewsOpening(discourse), [
    `${item.id}_headline`
  ]);

  const understanding = buildUnderstanding(item, digest, selectedIssues, baseEmotion, discourse);
  const memoryConnection = buildMemoryConnection(item, directMatches, context.memories ?? []);
  const aguriInterpretation = beat(
    item,
    "interpretation",
    "inference",
    sensitive ? "calm" : "curious",
    realizeNewsInterpretation(discourse),
    digest.topics.map((entry) => `topic:${entry.key}`)
  );

  const opinions = buildOpinions(
    item,
    digest,
    selectedIssues,
    directMatches,
    context.character,
    context.now ?? Date.now()
  );
  const aguriOpinion = beat(
    item,
    "opinion",
    "aguri_opinion",
    sensitive ? "calm" : baseEmotion,
    realizeNewsOpinion(discourse, selectedIssues[0]),
    [opinions.find((opinion) => opinion.owner === "aguri")?.id ?? `${item.id}_aguri_opinion`]
  );

  const uncertainty =
    digest.contentLevel !== "article_extract" || sensitive
      ? beat(
          item,
          "uncertainty",
          "unknown",
          sensitive ? "calm" : "confused",
          realizeNewsUncertainty(discourse),
          []
        )
      : undefined;
  const imagination =
    !sensitive && digest.contentLevel !== "headline_only"
      ? beat(item, "imagination", "imagination", "happy", realizeNewsImagination(discourse), [])
      : undefined;
  const responseQuestion = buildResponseQuestion(item, digest, selectedIssues, directMatches.length > 0);
  const userQuestion = beat(
    item,
    "question",
    digest.contentLevel === "headline_only" ? "unknown" : "inference",
    sensitive ? "calm" : "curious",
    responseQuestion.prompt,
    selectedIssues.flatMap((issue) => issue.evidenceIds)
  );

  const pages = [openingReaction, ...understanding];
  if (memoryConnection) pages.push(memoryConnection);
  pages.push(aguriInterpretation, aguriOpinion);
  if (uncertainty) pages.push(uncertainty);
  else if (imagination) pages.push(imagination);
  const boundedPages = pages.slice(0, 6);
  return {
    newsItemId: item.id,
    contentLevel: digest.contentLevel,
    openingReaction,
    understanding,
    ...(memoryConnection ? { memoryConnection } : {}),
    aguriInterpretation,
    aguriOpinion,
    ...(boundedPages.includes(uncertainty as NewsBeat) ? { uncertainty } : {}),
    ...(boundedPages.includes(imagination as NewsBeat) ? { imagination } : {}),
    userQuestion,
    selectedLens: lens,
    emotionCurve: boundedPages.map((page) => page.emotion),
    groundedFactIds: digest.keyFacts.map((fact) => fact.id),
    selectedIssueIds: selectedIssues.map((issue) => issue.id),
    conceptIds: directMatches.map((match) => match.concept.id),
    opinions,
    responseQuestion,
    pages: boundedPages
  };
}

export function buildNewsExplanation(item: NewsItem, concepts: Concept[]) {
  return buildNewsConversationPlan(item, fallbackDigest(item), concepts).pages.map((page) => page.text);
}

export function findNewsConcepts(item: NewsItem, digest: ArticleDigest, concepts: Concept[]) {
  const articleText = [
    item.title,
    item.summary,
    item.feedContent,
    ...digest.keySentences.map((entry) => entry.text)
  ]
    .filter(Boolean)
    .join(" ");
  return concepts
    .filter((concept) => concept.source === "user" && concept.active)
    .flatMap((concept) => {
      const variants = [concept.surface, displayConcept(concept), concept.reading, ...concept.aliases].filter(
        (value): value is string => Boolean(value)
      );
      const matched = variants
        .map((variant, index) => ({ variant, index, strength: matchVariant(articleText, variant) }))
        .filter((entry) => entry.strength > 0);
      const best = matched.sort(
        (left, right) => right.strength - left.strength || left.index - right.index
      )[0];
      if (!best) return [];
      const preferenceBonus = concept.preference ? Math.abs(concept.preference) * 0.2 : 0;
      const recencyPenalty = concept.lastUsedAt && Date.now() - concept.lastUsedAt < 86_400_000 ? 0.2 : 0;
      return [
        { concept, matchedText: best.variant, score: best.strength + preferenceBonus - recencyPenalty }
      ];
    })
    .sort((left, right) => right.score - left.score || left.concept.id.localeCompare(right.concept.id))
    .slice(0, 3);
}

function buildUnderstanding(
  item: NewsItem,
  digest: ArticleDigest,
  selectedIssues: ArticleDigest["issues"],
  emotion: NewsBeat["emotion"],
  discourse: NewsDiscourseFrame
) {
  const groundedIssues = selectedIssues.filter((issue) => issue.evidenceIds.length > 0).slice(0, 2);
  if (groundedIssues.length > 0) {
    return groundedIssues.map((issue, index) =>
      beat(
        item,
        "understanding",
        digest.contentLevel === "article_extract"
          ? "article"
          : digest.contentLevel === "feed_content"
            ? "feed_content"
            : "feed_summary",
        emotion,
        realizeNewsUnderstanding(discourse, issue, index),
        issue.evidenceIds
      )
    );
  }
  return [
    beat(item, "understanding", "headline", "confused", realizeHeadlineUnderstanding(discourse), [
      `${item.id}_headline`
    ])
  ];
}

function selectIssues(
  digest: ArticleDigest,
  lens: NewsConversationLens,
  matches: ReturnType<typeof findNewsConcepts>,
  relations: ConceptRelation[],
  memories: MemoryEvent[]
) {
  const rememberedConceptIds = new Set(memories.flatMap((memory) => memory.conceptIds));
  const relatedConceptIds = new Set(
    relations.flatMap((relation) => [relation.fromConceptId, relation.toConceptId])
  );
  const lensBonus = (kind: ArticleDigest["issues"][number]["kind"]) => {
    if (lens === "numbers_and_scale" && kind === "number") return 0.35;
    if (lens === "people_involved" && (kind === "person" || kind === "place")) return 0.3;
    if (lens === "practical_change" && ["change", "effect", "benefit", "risk"].includes(kind)) return 0.22;
    if (lens === "uncertainty" && kind === "uncertainty") return 0.3;
    return 0;
  };
  const personalBonus = (issue: ArticleDigest["issues"][number]) =>
    matches
      .filter(({ concept }) =>
        [concept.surface, concept.reading, ...concept.aliases]
          .filter((value): value is string => Boolean(value))
          .some((value) => issue.summary.includes(value))
      )
      .reduce(
        (bonus, { concept }) =>
          bonus +
          0.18 +
          (concept.preference === undefined ? 0 : Math.abs(concept.preference) * 0.05) +
          (rememberedConceptIds.has(concept.id) ? 0.1 : 0) +
          (relatedConceptIds.has(concept.id) ? 0.06 : 0),
        0
      );
  const ranked = [...digest.issues].sort(
    (left, right) =>
      right.importance +
      right.relevanceToUser +
      right.suitabilityForOpinion +
      lensBonus(right.kind) -
      (left.importance + left.relevanceToUser + left.suitabilityForOpinion + lensBonus(left.kind)) +
      personalBonus(right) -
      personalBonus(left)
  );
  const selected: ArticleDigest["issues"] = [];
  for (const issue of ranked) {
    const normalized = normalizeIssueSummary(issue.summary);
    const duplicatesSelected = selected.some((entry) => {
      const previous = normalizeIssueSummary(entry.summary);
      return (
        entry.kind === issue.kind ||
        (normalized.length >= 12 &&
          previous.length >= 12 &&
          (normalized.includes(previous) || previous.includes(normalized)))
      );
    });
    if (duplicatesSelected) continue;
    selected.push(issue);
    if (selected.length >= 2) break;
  }
  return selected;
}

function normalizeIssueSummary(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

function buildResponseQuestion(
  item: NewsItem,
  digest: ArticleDigest,
  issues: ArticleDigest["issues"],
  hasLearnedWord: boolean
): NewsConversationPlan["responseQuestion"] {
  if (digest.contentLevel === "headline_only") {
    return {
      prompt: `「${item.title}」は見出しだけ届いています。どこまで話しますか？`,
      options: [
        { intent: "interested", label: "見出しだけでも話す" },
        { intent: "ask_more", label: "元記事で確かめたい" },
        { intent: "close_topic", label: "今回はやめる" }
      ]
    };
  }
  const issue = issues[0];
  const prompt = issue
    ? `記事の「${issue.label}」について、どう感じますか？`
    : `「${item.title}」について、どう感じますか？`;
  const options: Array<{ intent: NewsResponseIntent; label: string }> =
    digest.tone === "sensitive"
      ? [
          { intent: "concerned", label: "心配している" },
          { intent: "personal_relevance", label: "生活にも関係しそう" },
          { intent: "ask_more", label: "もう少し確かめたい" },
          { intent: "close_topic", label: "ここで終える" }
        ]
      : issue?.kind === "number"
        ? [
            { intent: "surprised", label: "大きな数字だと思う" },
            { intent: "personal_relevance", label: "生活にも関係しそう" },
            { intent: "ask_more", label: "数字の理由を知りたい" },
            { intent: "not_interested", label: "今は気にならない" }
          ]
        : [
            { intent: "agree", label: "アグリの見方に近い" },
            { intent: "disagree", label: "少し違うと思う" },
            { intent: "interested", label: "もっと知りたい" },
            { intent: "not_interested", label: "今は気にならない" },
            ...(hasLearnedWord ? [{ intent: "correct_aguri" as const, label: "言葉のつながりを直す" }] : [])
          ];
  return { prompt, options };
}

function buildMemoryConnection(
  item: NewsItem,
  matches: ReturnType<typeof findNewsConcepts>,
  memories: MemoryEvent[]
) {
  if (matches.length === 0) return undefined;
  const labels = matches.map((match) => `「${displayConcept(match.concept)}」`).join("と");
  const memory = memories
    .filter((entry) => matches.some((match) => entry.conceptIds.includes(match.concept.id)))
    .sort((left, right) => right.createdAt - left.createdAt)[0];
  return beat(
    item,
    "memory",
    "memory",
    "curious",
    `教えてもらった${labels}が、今回の配信文に実際に出ています。${memory ? "前に覚えた時の記憶も残っています。" : "ここでは語の一致だけを確認しました。"}`,
    [...matches.map((match) => `concept:${match.concept.id}`), ...(memory ? [`memory:${memory.id}`] : [])]
  );
}

function buildOpinions(
  item: NewsItem,
  digest: ArticleDigest,
  selectedIssues: ArticleDigest["issues"],
  matches: ReturnType<typeof findNewsConcepts>,
  character: CharacterState | undefined,
  now: number
): CharacterOpinion[] {
  const userOpinions = matches.flatMap(({ concept }) =>
    concept.preference === undefined
      ? []
      : [
          {
            id: `${item.id}_user_${concept.id}`,
            owner: "user" as const,
            subjectConceptId: concept.id,
            polarity: concept.preference / 2,
            curiosity: 0,
            confidence: Math.max(0.4, concept.understanding),
            reason: "past_reaction" as const,
            createdAt: now,
            updatedAt: now
          }
        ]
  );
  const topicKey = digest.topics[0]?.key ?? "general";
  const curiosity = Math.min(1, Math.max(0.2, character?.curiosity ?? 0.6));
  const leadingIssue = selectedIssues[0];
  const polarity =
    leadingIssue?.kind === "benefit"
      ? 0.35
      : leadingIssue && ["risk", "conflict"].includes(leadingIssue.kind)
        ? -0.4
        : digest.tone === "positive"
          ? 0.3
          : digest.tone === "negative" || digest.tone === "sensitive"
            ? -0.3
            : 0;
  return [
    ...userOpinions,
    {
      id: `${item.id}_aguri_${topicKey}`,
      owner: "aguri",
      topicKey,
      polarity,
      curiosity,
      confidence: Math.min(0.75, digest.confidence),
      reason: leadingIssue ? "article_issue" : digest.tone === "unknown" ? "unknown" : "news_tone",
      createdAt: now,
      updatedAt: now
    }
  ];
}

function selectLens(
  digest: ArticleDigest,
  matches: ReturnType<typeof findNewsConcepts>,
  character?: CharacterState
): NewsConversationLens {
  if (matches.length > 0) return "learned_word";
  if (
    digest.numericalFacts.some((entry) =>
      /(?:％|%|人|件|回|円|ドル|キロ|km|駅|社|か所|カ所|倍|割|台|冊|個|本)$/iu.test(entry.value)
    )
  )
    return "numbers_and_scale";
  if (digest.entities.some((entity) => entity.kind === "person" || entity.kind === "organization"))
    return "people_involved";
  if (digest.contentLevel === "headline_only") return "uncertainty";
  if ((character?.curiosity ?? 0.5) >= 0.75) return "aguri_daily_life";
  return "practical_change";
}

function beat(
  item: NewsItem,
  kind: NewsBeat["kind"],
  source: NewsBeat["source"],
  emotion: NewsBeat["emotion"],
  text: string,
  evidenceIds: string[]
): NewsBeat {
  return {
    id: `${item.id}_${kind}_${hashText(text)}`,
    kind,
    source,
    emotion,
    text,
    evidenceIds
  };
}

function matchVariant(text: string, rawVariant: string) {
  const source = text.normalize("NFKC").toLowerCase();
  const variant = rawVariant.normalize("NFKC").trim().toLowerCase();
  if (Array.from(variant.replace(/[\s、。・「」『』（）()]/gu, "")).length < 2) return 0;
  if (/^[a-z0-9_+-]+$/iu.test(variant)) {
    return new RegExp(`(^|[^a-z0-9_])${escapeRegExp(variant)}(?=$|[^a-z0-9_])`, "iu").test(source) ? 4 : 0;
  }
  if (/^[ァ-ヶー]+$/u.test(variant)) {
    return Array.from(source.matchAll(/[ァ-ヶー]+/gu)).some((match) => match[0] === variant) ? 4 : 0;
  }
  const kanaSource = toHiragana(source).replace(/[\s、。・「」『』（）()]/gu, "");
  const kanaVariant = toHiragana(variant).replace(/[\s、。・「」『』（）()]/gu, "");
  return kanaSource.includes(kanaVariant) ? (variant === rawVariant.normalize("NFKC") ? 4 : 3) : 0;
}

function toHiragana(value: string) {
  return value.replace(/[ァ-ヶ]/gu, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function fallbackDigest(item: NewsItem): ArticleDigest {
  const contentLevel = item.feedContent ? "feed_content" : item.summary ? "feed_summary" : "headline_only";
  const evidence = [
    { id: `${item.id}_headline`, text: item.title, source: "headline" as const },
    ...(item.summary
      ? [{ id: `${item.id}_summary`, text: item.summary, source: "feed_summary" as const }]
      : [])
  ];
  return {
    newsItemId: item.id,
    contentLevel,
    sourceUrl: item.url,
    extractedAt: item.fetchedAt,
    keyFacts: item.summary
      ? [{ id: `${item.id}_fact_0`, text: item.summary, evidenceId: `${item.id}_summary` }]
      : [],
    keySentences: evidence,
    entities: [],
    topics: [
      { key: topicKey(`${item.title} ${item.summary}`), label: topicLabel(`${item.title} ${item.summary}`) }
    ],
    events: [],
    numericalFacts: [],
    issues: item.summary
      ? [
          {
            id: `${item.id}_issue_0`,
            label: "配信された要点",
            summary: item.summary,
            evidenceIds: [`${item.id}_fact_0`, `${item.id}_summary`],
            kind: "change",
            importance: 0.6,
            relevanceToUser: 0.45,
            suitabilityForOpinion: 0.55
          }
        ]
      : [],
    uncertainties: [contentLevel === "headline_only" ? "見出し以外の内容" : "記事全体の背景"],
    tone: sensitiveText(`${item.title} ${item.summary}`) ? "sensitive" : "neutral",
    confidence: contentLevel === "headline_only" ? 0.25 : 0.5
  };
}

function topicKey(text: string) {
  if (/(天気|気温|台風|大雨|地震|災害|雪|猛暑)/u.test(text)) return "weather_safety";
  if (/(選挙|政府|国会|首相|大統領|法律|自治体)/u.test(text)) return "society_politics";
  if (/(株|市場|経済|企業|物価|円相場|金融)/u.test(text)) return "economy";
  if (/(AI|人工知能|技術|科学|宇宙|アプリ|コンピュータ)/iu.test(text)) return "science_technology";
  if (/(電車|鉄道|道路|交通|空港|運休|駅)/u.test(text)) return "transport";
  return "general";
}

function topicLabel(text: string) {
  const labels: Record<string, string> = {
    weather_safety: "天気と安全",
    society_politics: "社会と政治",
    economy: "経済",
    science_technology: "科学と技術",
    transport: "交通",
    general: "世の中の出来事"
  };
  return labels[topicKey(text)] ?? labels.general ?? "世の中の出来事";
}

function sensitiveText(text: string) {
  return /(死亡|死者|亡くな|重大事故|災害|地震|戦争|犯罪|逮捕|病気|医療|自傷|自殺|差別|選挙|政府|国会|首相|大統領)/u.test(
    text
  );
}

function hashText(value: string) {
  return Array.from(value)
    .reduce(
      (hash, character) => Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16777619) >>> 0,
      2166136261
    )
    .toString(16);
}
