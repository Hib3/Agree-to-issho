import type { DialogueLog, WordCategory, WordFrame } from "../../types/domain";
import { systemRandom, type RandomSource } from "./random";

export type LearnedComposition = {
  text: string;
  followUpText: string;
  words: WordFrame[];
  templateId: string;
  semanticKey: string;
  drifted: boolean;
};

type SceneSlot = WordCategory | WordCategory[];

type ScenePattern = {
  id: string;
  slots: SceneSlot[];
  render: (words: WordFrame[]) => string;
};

const groundedPatterns: ScenePattern[] = [
  {
    id: "outing",
    slots: ["place", "action", ["object", "food"]],
    render: ([place, action, item]) =>
      `「${place.surface}」で「${action.surface}」の時間を過ごすなら、「${item.surface}」もそばにあると楽しそうです。`
  },
  {
    id: "shared_activity",
    slots: ["person", "action", "place"],
    render: ([person, action, place]) =>
      `「${person.surface}」と「${place.surface}」で「${action.surface}」の話をしたら、どんな一日になるんでしょう。`
  },
  {
    id: "mood_after_action",
    slots: ["action", "feeling", ["person", "place"]],
    render: ([action, feeling, companion]) =>
      `「${companion.surface}」を思い出しながら「${action.surface}」の時間を過ごすと、「${feeling.surface}」に近い気分になりそうです。`
  },
  {
    id: "timed_plan",
    slots: ["time", "action", ["object", "food"]],
    render: ([time, action, item]) =>
      `「${time.surface}」に「${action.surface}」の予定があるなら、「${item.surface}」も忘れないようにしたいです。`
  },
  {
    id: "favorite_memory",
    slots: ["food", ["person", "place"], "feeling"],
    render: ([food, companion, feeling]) =>
      `「${companion.surface}」と「${food.surface}」を同じメモに書くと、「${feeling.surface}」の印が似合いそうです。`
  }
];

export function composeLearnedScene(
  primary: WordFrame,
  words: WordFrame[],
  recentLogs: DialogueLog[] = [],
  drifted = false,
  random: RandomSource = systemRandom
): LearnedComposition | null {
  const recentIds = new Set(recentLogs.slice(-3).flatMap((log) => log.used_word_ids));
  const eligible = words.filter((word) => isUsable(word) && (word.id === primary.id || !recentIds.has(word.id)));
  if (!eligible.some((word) => word.id === primary.id) || eligible.length < 2) return null;

  if (drifted) return composeSingleRoleDrift(primary, eligible, random);

  const matchingPatterns = groundedPatterns.filter((pattern) =>
    pattern.slots.some((slot) => slotMatches(slot, primary.category))
  );
  const offset = Math.floor(random.next() * Math.max(1, matchingPatterns.length));
  for (let index = 0; index < matchingPatterns.length; index += 1) {
    const pattern = matchingPatterns[(index + offset) % matchingPatterns.length];
    const selected = fillPattern(pattern, primary, eligible, random);
    if (!selected) continue;
    return {
      text: pattern.render(selected),
      followUpText: "この三つを、ひとつの出来事として覚えてもいいですか？",
      words: uniqueWords([primary, ...selected]),
      templateId: `composition_${pattern.id}`,
      semanticKey: `composition.grounded.${pattern.id}`,
      drifted: false
    };
  }

  const partner = pickPartner(primary, eligible, random);
  if (!partner) return null;
  return {
    text: `「${primary.surface}」と「${partner.surface}」を同じ日のメモに並べたら、ひとつの話が始まりそうです。どんなつながりか、もっと知りたいです。`,
    followUpText: "この二つは、アグリのノートでも近くに置いていいですか？",
    words: [primary, partner],
    templateId: "composition_open_pair",
    semanticKey: "composition.grounded.open_pair",
    drifted: false
  };
}

function composeSingleRoleDrift(primary: WordFrame, eligible: WordFrame[], random: RandomSource): LearnedComposition | null {
  const others = eligible.filter((word) => word.id !== primary.id);
  if (others.length === 0) return null;
  const action = pick(others.filter((word) => word.category === "action"), random) ?? pick(others, random);
  const third = pick(
    others.filter((word) => word.id !== action?.id && word.category !== primary.category),
    random
  );
  const used = uniqueWords([primary, action, third].filter((word): word is WordFrame => Boolean(word)));
  const variant = Math.floor(random.next() * 3);
  const second = used[1];
  if (!second) return null;

  const texts = [
    `「${primary.surface}」に着いたら、「${second.surface}」の時間が始まるって覚えかけています。${used[2] ? `そこには「${used[2].surface}」もあるんですよね？` : "このつなげ方で合っていますか？"}`,
    `「${primary.surface}」の中に「${second.surface}」をしまっておくと、${used[2] ? `「${used[2].surface}」の時に役立つ` : "あとで役立つ"}んですよね？`,
    `「${primary.surface}」が「${second.surface}」のことを話して、${used[2] ? `「${used[2].surface}」につながる` : "次の話につながる"}って思ったんです。少しずれていますか？`
  ];
  return {
    text: texts[variant],
    followUpText: "このつながりで合っていますか？ 一か所だけ、怪しい気もしますっ！",
    words: used,
    templateId: `composition_drift_role_${variant + 1}`,
    semanticKey: `composition.drift.single_role.${variant + 1}`,
    drifted: true
  };
}

function fillPattern(pattern: ScenePattern, primary: WordFrame, eligible: WordFrame[], random: RandomSource): WordFrame[] | null {
  const primarySlot = pattern.slots.findIndex((slot) => slotMatches(slot, primary.category));
  if (primarySlot < 0) return null;
  const selected: Array<WordFrame | null> = pattern.slots.map(() => null);
  selected[primarySlot] = primary;
  for (let index = 0; index < pattern.slots.length; index += 1) {
    if (selected[index]) continue;
    const candidates = eligible.filter((word) =>
      !selected.some((chosen) => chosen?.id === word.id) && slotMatches(pattern.slots[index], word.category)
    );
    const chosen = pick(candidates, random);
    if (!chosen) return null;
    selected[index] = chosen;
  }
  return selected as WordFrame[];
}

function pickPartner(primary: WordFrame, eligible: WordFrame[], random: RandomSource) {
  const others = eligible.filter((word) => word.id !== primary.id);
  const linked = others.filter((word) => primary.related_word_ids.includes(word.id));
  const differentCategory = others.filter((word) => word.category !== primary.category);
  return pick(linked, random) ?? pick(differentCategory, random) ?? pick(others, random);
}

function pick(words: WordFrame[], random: RandomSource): WordFrame | null {
  if (words.length === 0) return null;
  return words[Math.floor(random.next() * words.length)] ?? null;
}

function slotMatches(slot: SceneSlot, category: WordCategory) {
  return Array.isArray(slot) ? slot.includes(category) : slot === category;
}

function isUsable(word: WordFrame) {
  return !word.is_blocked && !word.is_sensitive && !word.forgotten_at && word.surface.trim().length > 0;
}

function uniqueWords(words: WordFrame[]) {
  return words.filter((word, index) => words.findIndex((item) => item.id === word.id) === index);
}
