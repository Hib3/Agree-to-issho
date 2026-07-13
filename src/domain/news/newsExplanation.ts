import type { CharacterState } from "../model/character";
import type { Concept } from "../model/concept";
import type { MemoryEvent } from "../model/memory";
import type {
  ArticleDigest,
  CharacterOpinion,
  NewsBeat,
  NewsConversationLens,
  NewsConversationPlan,
  NewsItem
} from "../model/news";
import type { ConceptRelation } from "../model/relation";
import { displayConcept } from "../grammar/japaneseRealizer";
import { applyAguriVoice } from "../voice/aguriVoice";

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
  const topic = digest.topics[0] ?? { key: "general", label: "世の中の出来事" };
  const target = selectSpecificTarget(digest);
  const lens = selectLens(digest, directMatches, context.character);
  const baseEmotion: NewsBeat["emotion"] = sensitive
    ? "calm"
    : digest.tone === "positive"
      ? "happy"
      : "curious";
  const openingReaction = beat(
    item,
    "opening",
    "headline",
    baseEmotion,
    `「${item.title}」という見出しの中で、${target}に目が止まりました。`,
    [`${item.id}_headline`]
  );

  const understanding = buildUnderstanding(item, digest, baseEmotion);
  const memoryConnection = buildMemoryConnection(item, directMatches, context.memories ?? []);
  const aguriInterpretation = beat(
    item,
    "interpretation",
    "inference",
    sensitive ? "calm" : "curious",
    digest.contentLevel === "headline_only"
      ? `見出しの言葉だけなら、${topic.label}の話かもしれません。ただ、記事に何が書かれているかは不明です。`
      : `${topic.label}の動きとして読むのが近そうです。ここは配信文からアグリが整理した受け取り方です。`,
    digest.topics.map((entry) => `topic:${entry.key}`)
  );

  const opinions = buildOpinions(item, digest, directMatches, context.character, context.now ?? Date.now());
  const aguriOpinion = beat(
    item,
    "opinion",
    "aguri_opinion",
    sensitive ? "calm" : baseEmotion,
    opinionText(target, digest, context.character),
    [opinions.find((opinion) => opinion.owner === "aguri")?.id ?? `${item.id}_aguri_opinion`]
  );

  const uncertainty =
    digest.contentLevel !== "article_extract" || sensitive
      ? beat(
          item,
          "uncertainty",
          "unknown",
          sensitive ? "calm" : "confused",
          digest.contentLevel === "headline_only"
            ? `「${item.title}」は見出しだけなので、何が起きたのか、背景や真偽までは決められません。`
            : `配信された範囲では、記事全体の背景や真偽までは決められません。${digest.uncertainties[0] ?? "追加の文脈"}はまだ不明です。`,
          []
        )
      : undefined;
  const imagination =
    !sensitive && digest.contentLevel !== "headline_only"
      ? beat(item, "imagination", "imagination", "happy", imaginationText(topic.key, target), [])
      : undefined;

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
    selectedLens: lens,
    emotionCurve: boundedPages.map((page) => page.emotion),
    groundedFactIds: digest.keyFacts.map((fact) => fact.id),
    conceptIds: directMatches.map((match) => match.concept.id),
    opinions,
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

function buildUnderstanding(item: NewsItem, digest: ArticleDigest, emotion: NewsBeat["emotion"]) {
  const fact = digest.keyFacts[0];
  if (fact) {
    const sourceLabel =
      digest.contentLevel === "article_extract"
        ? "取得できた記事本文"
        : digest.contentLevel === "feed_content"
          ? "RSS内の本文"
          : "RSSの短い説明";
    return [
      beat(
        item,
        "understanding",
        digest.contentLevel === "article_extract"
          ? "article"
          : digest.contentLevel === "feed_content"
            ? "feed_content"
            : "feed_summary",
        emotion,
        `${sourceLabel}では、「${fact.text}」と確認できます。`,
        [fact.id, fact.evidenceId]
      )
    ];
  }
  return [
    beat(
      item,
      "understanding",
      "headline",
      "confused",
      `今確認できる事実は、「${item.title}」という見出しが配信されたことまでです。`,
      [`${item.id}_headline`]
    )
  ];
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
  const polarity =
    digest.tone === "positive" ? 0.45 : digest.tone === "negative" || digest.tone === "sensitive" ? -0.35 : 0;
  return [
    ...userOpinions,
    {
      id: `${item.id}_aguri_${topicKey}`,
      owner: "aguri",
      topicKey,
      polarity,
      curiosity,
      confidence: Math.min(0.75, digest.confidence),
      reason: digest.tone === "unknown" ? "unknown" : "news_tone",
      createdAt: now,
      updatedAt: now
    }
  ];
}

function opinionText(target: string, digest: ArticleDigest, character?: CharacterState) {
  if (digest.tone === "sensitive") {
    return `${target}に関わる人の状況を、軽く決めつけずに読みたいです。分からない部分を埋めたふりはしません。`;
  }
  const numerical = digest.numericalFacts[0]?.value;
  if (numerical)
    return `${numerical}という規模が具体的で気になります。数字が誰の生活をどう変えるのかまで確かめたいです。`;
  if (digest.tone === "positive")
    return `${target}が実際にどこまで続く変化なのかに注目したいです。始まった瞬間だけでなく、その後も見たいです。`;
  if (digest.tone === "negative")
    return `${target}の影響を受ける人が何に困るのかを先に知りたいです。大きな言葉だけで済ませたくありません。`;
  return `${target}が日常のどこを変えるのかに興味があります。アグリの好奇心は${(character?.curiosity ?? 0.6) >= 0.7 ? "かなり動いています" : "静かに動いています"}。`;
}

function imaginationText(topicKey: string, target: string) {
  if (topicKey === "transport")
    return `ここからはアグリの想像です。${target}が駅の話なら、初日は案内板を二回見て、それでも反対側へ歩きそうです。`;
  if (topicKey === "science_technology")
    return `ここからはアグリの想像です。${target}が忘れ物も見つけられるなら、机の下の三日前のメモを最初に救出してほしいです。`;
  if (topicKey === "economy")
    return `ここからはアグリの想像です。${target}が値札に表れたら、アグリは一度通り過ぎてから、そっと二度見します。`;
  if (topicKey === "culture")
    return `ここからはアグリの想像です。${target}を見に行く予定をノートへ書いて、予定を書いたことだけで少し満足しそうです。`;
  return `ここからはアグリの想像です。${target}の続きが気になって、ノートの余白へ先に予想を書き込みそうです。`;
}

function selectSpecificTarget(digest: ArticleDigest) {
  const concreteTarget = digest.numericalFacts[0]?.value ?? digest.entities[0]?.name;
  if (concreteTarget) return concreteTarget;
  const topic = digest.topics[0];
  return topic && topic.key !== "general" ? `${topic.label}への影響` : "配信文が示す出来事";
}

function selectLens(
  digest: ArticleDigest,
  matches: ReturnType<typeof findNewsConcepts>,
  character?: CharacterState
): NewsConversationLens {
  if (matches.length > 0) return "learned_word";
  if (digest.numericalFacts.length > 0) return "numbers_and_scale";
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
    text: applyAguriVoice(text, emotion),
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
