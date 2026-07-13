import type { CompositionProposition, ConversationIntent } from "../model/conversation";
import type { Concept } from "../model/concept";
import type { RandomSource } from "../../infrastructure/random/random";
import { pickOne } from "../../infrastructure/random/random";
import { displayConcept } from "../grammar/japaneseRealizer";
import { controlledPremise } from "./absurdityController";
import type { ScoredCandidate } from "./scorer";
import { attributeMemoryBeat } from "./attributeNarration";

export function buildNarrativePages(input: {
  candidate: ScoredCandidate;
  proposition: CompositionProposition;
  rendered: string;
  random: RandomSource;
}) {
  const concepts = Object.values(input.candidate.slots);
  const usedConcepts = input.proposition.wordIds
    .map((id) => concepts.find((concept) => concept.id === id))
    .filter((concept): concept is Concept => Boolean(concept));
  const focus = usedConcepts.find((concept) => concept.source === "user") ?? usedConcepts[0];
  if (!focus) return [];
  const learnedAttributeBeat = attributeMemoryBeat(focus);

  if (input.proposition.relationType === "relation_discovery") {
    const names = usedConcepts.slice(0, 2).map(quoted);
    return [
      `${names.join("と")}を、同じページで見つけましたっ。`,
      learnedAttributeBeat,
      `${names.join("と")}の間には、教わった関係がまだありませんっ。`
    ].filter(Boolean);
  }

  if (input.proposition.relationType === "confirmed_relation" && input.candidate.template.grounding === "relation_required") {
    const frameId = input.candidate.template.semanticFrame.split(".").at(-1) ?? "";
    if (frameId !== "word_pair_relation" && input.candidate.template.intent !== "ask_relation") {
      return [
        openingForIntent(input.candidate.template.intent, focus),
        learnedAttributeBeat,
        `${input.proposition.relationText}と覚えていますっ。`,
        input.rendered,
        outcomeForFrame(input.candidate, input.random)
      ].filter(Boolean);
    }
    return [
      openingForIntent(input.candidate.template.intent, focus),
      `${input.proposition.relationText}と覚えていますっ。`,
      `${usedConcepts.slice(0, 2).map(quoted).join("と")}なら、同じ小話に出しても迷いにくそうですっ。`
    ];
  }

  if (input.proposition.relationType === "single_word") {
    const frameId = input.candidate.template.semanticFrame.split(".").at(-1) ?? "";
    if (frameId === "single_topic") {
      return [openingForIntent(input.candidate.template.intent, focus), learnedAttributeBeat, memoryBeat(focus)].filter(Boolean);
    }
    return [
      openingForIntent(input.candidate.template.intent, focus),
      learnedAttributeBeat,
      input.rendered,
      outcomeForFrame(input.candidate, input.random)
    ].filter(Boolean);
  }

  const opening = openingForIntent(input.candidate.template.intent, focus);
  if (input.proposition.relationType === "drift_hypothesis") {
    const premise = controlledPremise(input.candidate).premise;
    const names = usedConcepts.map(quoted).join("・");
    return [
      opening,
      learnedAttributeBeat,
      premise,
      input.rendered,
      `${names}の使い方は、アグリの想像が飛びすぎたかもしれませんっ。`
    ].filter(Boolean);
  }

  const outcome = outcomeForFrame(input.candidate, input.random);
  return [opening, learnedAttributeBeat, input.rendered, outcome].filter(Boolean);
}

function openingForIntent(intent: ConversationIntent, focus: Concept) {
  const word = quoted(focus);
  const openings: Record<ConversationIntent, string> = {
    small_talk: `ねえっ、${word}のことで小さな話を考えましたっ。`,
    ask_meaning: `${word}の覚え方を、もう一度確かめたいですっ。`,
    ask_preference: `${word}のこと、もっと知りたいですっ。`,
    ask_relation: `${word}から伸びるノートの線を見直していますっ。`,
    recall_memory: `前に教えてもらった${word}を、ノートで見つけましたっ。`,
    rumor: `${word}が出てくる、ちょっとした噂の小話を考えましたっ。`,
    observation: `${word}を見ていたら、一つ気づきましたっ。`,
    warning: `${word}のことで、気をつけたい場面がありますっ。`,
    invitation: `${word}を使ったお出かけを、ひとつ考えましたっ。`,
    discovery: `あっ、${word}から新しい場面を思いつきましたっ！`,
    comparison: `${word}を、もう一つの言葉と比べてみますっ。`,
    daydream: `${word}から、小さな空想が始まりましたっ。`,
    misunderstanding: `${word}の使い方、ちょっと怪しいかもしれませんっ。`,
    outing_report: `${word}を使った、お出かけの小話を考えましたっ。`,
    quiet_moment: `静かにしていたら、${word}を思い出しましたっ。`
  };
  return openings[intent];
}

function memoryBeat(concept: Concept) {
  const word = quoted(concept);
  if (concept.preference !== undefined && concept.preference >= 2) return `${word}は好きだと教わっていますっ！`;
  if (concept.preference !== undefined && concept.preference <= -2) return `${word}は苦手だと教わったから、話に出しすぎませんっ。`;
  if (concept.understanding < 0.58 || concept.ambiguity > 0.52) return `${word}は、まだ覚え方が少しふわふわしていますっ。`;
  if (concept.usageCount === 0) return `${word}を話に使うのは、今日が初めてですっ！`;
  return `${word}は前より少し、迷わず使えるようになりましたっ。`;
}

function outcomeForFrame(candidate: ScoredCandidate, random: RandomSource) {
  const frameId = candidate.template.semanticFrame.split(".").at(-1) ?? "";
  const value = (name: string) => {
    const concept = candidate.slots[name];
    return concept ? quoted(concept) : "";
  };
  const outcomes: Record<string, string[]> = {
    person_daily_encounter: [
      `${value("person")}へ挨拶したあと、どんな話をするか少し迷いそうですっ。`,
      `${value("person")}に気づいたら、まず落ち着いて声をかけたいですっ。`
    ],
    food_small_ritual: [
      `${value("food")}を置く場所が決まったら、いつもの時間が少し楽しみになりそうですっ。`,
      `${value("food")}を楽しんだあとは、次の日の分があるか確かめたくなりそうですっ。`
    ],
    place_short_visit: [
      `${value("place")}へ着いたら、急がず一つだけ気になる物を探したいですっ。`,
      `${value("place")}を出る前に、また来たいかノートへ書いておきますっ。`
    ],
    object_missing_plan: objectMissingOutcome(candidate),
    action_small_goal: [
      `${value("action")}を始める時間を短く決めたら、取りかかりやすそうですっ。`,
      `できた所まで印をつければ、${value("action")}の続きも忘れませんっ。`
    ],
    living_quiet_observation: [
      `${value("living")}が驚かない距離から、しばらく静かに見ていたいですっ。`,
      `${value("living")}の様子が変わったら、あとでノートに描いておきたいですっ。`
    ],
    person_action_place: [
      `ところがっ、${value("person")}は終わったはずの${value("action")}を、${value("place")}の端でもう一度始めたんですっ！`,
      `${value("person")}が${value("action")}を終えるころ、${value("place")}は最初より少しにぎやかになっていそうですっ！`
    ],
    person_food_observation: [
      `${value("person")}は${value("food")}を見て、ちょっと機嫌がよくなりそうですっ。`,
      `${value("food")}がなくなったら、${value("person")}は少しだけ探しそうですっ。`
    ],
    place_object_discovery: [
      `${value("object")}は、持ち主が戻るまで${value("place")}の目立つ所で待ってもらいますっ。`,
      `${value("place")}を離れる前に、${value("object")}のことをメモしておきますっ。`
    ],
    vehicle_container_message: [
      `${value("container")}を忘れたら、${value("vehicle")}を降りて取りに戻ることになりそうですっ。`,
      `${value("vehicle")}が動き出す前に、${value("container")}を確かめたいですっ。`
    ],
    action_body_warning: [
      `${value("body")}が疲れる前に、${value("action")}をいったん休みますっ。`,
      `${value("action")}を続けるなら、${value("body")}の様子も見ておきたいですっ。`
    ],
    person_object_rumor: [
      `${value("person")}が${value("object")}を大事にする理由まで、アグリはまだ知りませんっ。`,
      `${value("object")}を見るたび、${value("person")}の話を思い出しそうですっ。`
    ],
    time_feeling_memory: [
      `${value("time")}のたびに、${value("feeling")}のメモが少し増えそうですっ。`,
      `${value("feeling")}を忘れそうな日は、${value("time")}を目印にしますっ。`
    ],
    food_place_invitation: [
      `${value("food")}を食べ終わるまで、${value("place")}でゆっくりしたいですっ。`,
      `${value("place")}へ着いたら、まず${value("food")}を探したくなりそうですっ！`
    ],
    object_action_plan: [
      `${value("object")}が見つからなかったら、${value("action")}を始める前に少し困りそうですっ。`,
      `${value("action")}の準備として、${value("object")}を見える所へ置きますっ。`
    ],
    wearable_person_comparison: [
      `${value("person")}が${value("wearable")}を選んだ理由も、ちょっと聞いてみたいですっ。`,
      `${value("wearable")}を見たら、${value("person")}のことまで思い出しそうですっ。`
    ],
    living_place_observation: [
      `${value("living")}が驚かないように、${value("place")}では静かに見ていたいですっ。`,
      `${value("place")}を通るたび、${value("living")}がいないか探しそうですっ。`
    ],
    idea_comparison: [
      `${value("idea")}と${value("otherIdea")}は、同じ所より違う所から覚えたいですっ。`,
      `${value("idea")}を話すときは、${value("otherIdea")}と混ぜないようにしますっ。`
    ],
    music_person_memory: [
      `${value("music")}が終わっても、${value("person")}のことは少し残りそうですっ。`,
      `${value("person")}の話をすると、今度は${value("music")}を聞きたくなりそうですっ。`
    ],
    body_action_discovery: [
      `${value("action")}を続けるたび、${value("body")}の新しい使い方に気づきそうですっ。`,
      `${value("body")}がびっくりしないように、${value("action")}はゆっくり始めますっ。`
    ],
    vehicle_place_outing: [
      `${value("place")}へ着いたら、帰りの${value("vehicle")}も忘れずに確かめますっ。`,
      `${value("vehicle")}から見える${value("place")}を、アグリのノートに描きたいですっ。`
    ],
    object_container_daydream: containerOutcome(candidate)
  };
  const variants = outcomes[frameId] ?? ["この小話は、ノートの端に残しておきますっ。"];
  return pickOne(variants, random) ?? variants[0] ?? "";
}

function quoted(concept: Concept) {
  return `「${displayConcept(concept)}」`;
}

function containerOutcome(candidate: ScoredCandidate) {
  const container = candidate.slots.container;
  const object = candidate.slots.object;
  if (!container || !object) return ["入れ物の場面は、もう一度考え直しますっ。"];
  const containerName = quoted(container);
  const objectName = quoted(object);
  if (container.userCategory === "place") {
    return [
      `${containerName}へ入って${objectName}を見つけたら、アグリは二度見しますっ！`,
      `${objectName}がある場所は、本当に${containerName}でいいのか迷いそうですっ。`
    ];
  }
  return [
    `${containerName}を開けて${objectName}が出てきたら、アグリは二度見しますっ！`,
    `${objectName}を戻す入れ物は、本当に${containerName}でいいのか迷いそうですっ。`
  ];
}

function objectMissingOutcome(candidate: ScoredCandidate) {
  const object = candidate.slots.object;
  if (!object) return ["見つからない物のことは、順番に思い出しますっ。"];
  const word = quoted(object);
  const importance = String(object.attributes.importanceWhenMissing ?? "unknown");
  if (importance === "essential") {
    return [`${word}がないととても困ると教わったから、出かける前に必ず確かめますっ。`];
  }
  if (importance === "troublesome") {
    return [`${word}がないと少し困るから、代わりを探す時間も考えておきますっ。`];
  }
  if (importance === "replaceable") {
    return [`${word}が見つからない日は、教わった通り代わりの物を使いますっ。`];
  }
  return [`${word}が見つからない時にどのくらい困るか、まだアグリは知りませんっ。`];
}
