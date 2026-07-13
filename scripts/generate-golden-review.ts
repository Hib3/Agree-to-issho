import { mkdir, writeFile } from "node:fs/promises";
import { createDebugLearnedConcepts } from "../src/data/debug/createDebugLearnedConcepts";
import { dialogueTemplates } from "../src/data/dialogue-templates/dialogueTemplates";
import { locations } from "../src/data/locations/locations";
import { responsePatterns } from "../src/data/response-patterns/responsePatterns";
import { validateConversationSession } from "../src/domain/conversation/dialogueValidator";
import { buildIntentBias } from "../src/domain/conversation/intentPolicy";
import { planConversation } from "../src/domain/conversation/planner";
import type { CharacterState } from "../src/domain/model/character";
import type { ConversationSession } from "../src/domain/model/conversation";
import type { ArticleDigest, NewsItem } from "../src/domain/model/news";
import { buildNewsConversationPlan } from "../src/domain/news/newsExplanation";
import { SeededRandom } from "../src/infrastructure/random/random";

const now = 1_700_000_000_000;
const concepts = createDebugLearnedConcepts(100, now);
const character: CharacterState = {
  id: "aguri",
  name: "アグリちゃん",
  emotion: "curious",
  energy: 78,
  closeness: 35,
  curiosity: 0.82,
  socialNeed: 24,
  trust: 38,
  boredom: 26,
  currentLocationId: "room",
  lastUserInteractionAt: now,
  lastSpeechAt: now,
  updatedAt: now
};
const lines = [
  "# アグリといっしょ ゴールデンレビュー",
  "",
  `生成日時: ${new Date().toISOString()}`,
  "",
  "> 自動生成結果です。自然さやキャラクターらしさは自動判定せず、全件を要人間確認とします。",
  "",
  "## 会話200件"
];
const recent: ConversationSession[] = [];

for (let seed = 1; seed <= 200; seed += 1) {
  const location = locations[seed % locations.length] ?? locations[0]!;
  const sessionNow = now + seed * 60_000;
  const session = planConversation({
    templates: dialogueTemplates,
    responsePatterns,
    concepts,
    relations: [],
    recentSessions: recent,
    character: { ...character, currentLocationId: location.id },
    locationId: location.id,
    now: sessionNow,
    random: new SeededRandom(seed),
    randomSeed: seed,
    intentBias: buildIntentBias({ concepts, recentSessions: recent, character, location, now: sessionNow })
  });
  const selected = Object.values(session.slotConceptIds).flatMap(
    (id) => concepts.find((concept) => concept.id === id) ?? []
  );
  const beats = session.narrativePlan?.beats ?? [];
  const validation = [...validateConversationSession(session), ...session.validationErrors];
  lines.push(
    "",
    `### 会話 ${seed} - 要人間確認`,
    "",
    `- seed: ${seed}`,
    `- 使用Concept: ${selected.map((concept) => `${concept.surface} (${concept.id})`).join(", ") || "なし"}`,
    `- 属性: ${compactJson(selected.map((concept) => concept.attributes))}`,
    "- Relation: なし（未確認関係を作らない条件）",
    "- Memory: 合成監査ではなし",
    `- userPreference: ${selected.map((concept) => `${concept.surface}:${concept.preference ?? "未設定"}`).join(", ") || "なし"}`,
    "- aguriPreference: 永続値なし（CharacterStateから一時反応のみ）",
    `- intent: ${session.intent}`,
    `- conversation lens: ${session.narrativePlan?.lens ?? "なし"}`,
    `- NarrativePlan: ${compactJson(session.narrativePlan ?? null)}`,
    `- setup: ${beats.find((beat) => beat.kind === "setup")?.text ?? "なし"}`,
    `- turn: ${beats.find((beat) => beat.kind === "turn")?.text ?? "なし"}`,
    `- payoff: ${beats.find((beat) => beat.kind === "payoff")?.text ?? "なし"}`,
    `- punchline mechanism: ${session.narrativePlan?.mechanism ?? "なし"}`,
    `- discourse referent: ${compactJson(session.proposition)}`,
    "- contentLevel / ArticleDigest / NewsGrounding: 会話サンプルのため対象外",
    `- 口調変換前: ${session.queuedTurns.map((turn) => turn.page).join(" / ")}`,
    `- 口調変換後: ${session.queuedTurns.map((turn) => turn.styledPreview).join(" / ")}`,
    `- 最終ページ列: ${compactJson(session.queuedTurns.map((turn) => turn.styledPreview))}`,
    `- validator結果: ${validation.length === 0 ? "成功" : validation.join(", ")}`,
    "- 人間レビュー: [ ] アグリらしい [ ] 自然な日本語 [ ] 流れがある [ ] オチが前振りへ戻る [ ] 同じ話し方へ偏らない"
  );
  recent.push({ ...session, phase: "completed", completedAt: sessionNow });
  if (recent.length > 24) recent.shift();
}

lines.push("", "## ニュース100件");
const newsTopics = [
  ["宇宙", "研究所が宇宙観測の結果を公開した。", "science_technology", "科学と技術", false],
  ["電車", "交通局が三つの駅で案内表示を試す。", "transport", "交通", false],
  ["市場", "市場で商品の価格が前月から変化した。", "economy", "経済", false],
  ["音楽", "市民会館で音楽の催しを開く。", "culture", "文化", false],
  ["地震", "自治体が地震の被害状況を確認している。", "weather_safety", "災害", true],
  ["医療", "医療機関が感染状況を調査している。", "health", "医療", true]
] as const;

for (let seed = 1; seed <= 100; seed += 1) {
  const [word, summary, topicKey, topicLabel, sensitive] = newsTopics[seed % newsTopics.length]!;
  const contentLevel =
    seed % 3 === 0
      ? ("headline_only" as const)
      : seed % 3 === 1
        ? ("feed_summary" as const)
        : ("article_extract" as const);
  const item: NewsItem = {
    id: `golden_news_${seed}`,
    feedId: "golden_feed",
    sourceName: "固定レビュー通信",
    title: `${word}についての更新 ${seed}`,
    summary: contentLevel === "headline_only" ? "" : summary,
    url: `https://example.com/golden/${seed}`,
    publishedAt: now + seed,
    fetchedAt: now + seed
  };
  const digest: ArticleDigest = {
    newsItemId: item.id,
    contentLevel,
    sourceUrl: item.url,
    extractedAt: item.fetchedAt,
    keyFacts:
      contentLevel === "headline_only"
        ? []
        : [{ id: `${item.id}_fact`, text: summary, evidenceId: `${item.id}_detail` }],
    keySentences: [
      { id: `${item.id}_headline`, text: item.title, source: "headline" },
      ...(contentLevel === "headline_only"
        ? []
        : [
            {
              id: `${item.id}_detail`,
              text: summary,
              source: contentLevel === "article_extract" ? ("article" as const) : ("feed_summary" as const)
            }
          ])
    ],
    entities: [],
    topics: [{ key: topicKey, label: topicLabel }],
    events: [],
    numericalFacts: [],
    uncertainties: ["記事全体の背景"],
    tone: sensitive ? "sensitive" : "neutral",
    confidence: contentLevel === "headline_only" ? 0.25 : contentLevel === "feed_summary" ? 0.5 : 0.78
  };
  const plan = buildNewsConversationPlan(item, digest, concepts, { character, now: item.fetchedAt });
  lines.push(
    "",
    `### ニュース ${seed} - 要人間確認`,
    "",
    `- seed: ${seed}`,
    `- 使用Concept: ${plan.conceptIds.join(", ") || "なし"}`,
    "- 属性 / Relation / Memory: この固定サンプルでは未設定",
    `- userPreference / aguriPreference: ${compactJson(plan.opinions)}`,
    `- conversation lens: ${plan.selectedLens}`,
    `- contentLevel: ${plan.contentLevel}`,
    `- ArticleDigest: ${compactJson(digest)}`,
    `- NewsGrounding: ${compactJson(plan.pages.map((page) => ({ page: page.id, source: page.source, evidenceIds: page.evidenceIds })))}`,
    `- grounded fact: ${compactJson(digest.keyFacts)}`,
    `- アグリ主観の由来: ${compactJson(plan.opinions.filter((opinion) => opinion.owner === "aguri"))}`,
    `- 空想部分: ${plan.imagination?.text ?? "なし"}`,
    `- 不明部分: ${plan.uncertainty?.text ?? "なし"}`,
    `- 最終ページ列: ${compactJson(plan.pages.map((page) => page.text))}`,
    `- validator結果: ${plan.pages.length >= 3 && plan.pages.length <= 6 ? "構造検査成功" : "ページ数違反"}`,
    "- 人間レビュー: [ ] アグリらしい [ ] 自然な日本語 [ ] 一つの流れ [ ] 実際に考えて見える [ ] 事実・主観・空想が分離"
  );
}

await mkdir("output/ultra-audit", { recursive: true });
await writeFile("output/ultra-audit/golden-review.md", `${lines.join("\n")}\n`, "utf8");
console.log(
  "golden review generated: output/ultra-audit/golden-review.md (200 conversations, 100 news conversations)"
);

function compactJson(value: unknown) {
  return JSON.stringify(value).replace(/\|/gu, "\\|");
}
