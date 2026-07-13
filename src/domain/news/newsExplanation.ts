import type { Concept } from "../model/concept";
import type { NewsItem } from "../model/news";
import { displayConcept } from "../grammar/japaneseRealizer";

export function buildNewsExplanation(item: NewsItem, concepts: Concept[]) {
  const pages = [
    `${item.sourceName}から、新しい見出しを見つけましたっ！「${item.title}」というニュースですっ！`,
    item.summary
      ? `配信された短い説明には、「${item.summary}」とありますっ。`
      : "配信された情報は見出しだけでしたっ。詳しい内容は、まだアグリには分かりませんっ。",
    `これは${topicLabel(`${item.title} ${item.summary}`)}に関する更新のようですっ。見出しと短い説明だけでは、背景や真偽までは決められませんっ。`
  ];
  const matched = concepts
    .filter((concept) => concept.source === "user" && concept.active)
    .find((concept) => `${item.title} ${item.summary}`.includes(displayConcept(concept)));
  if (matched) {
    pages.push(`教えてもらった「${displayConcept(matched)}」も、このニュースに出てきましたっ！前に覚えた言葉と、今の出来事がつながりましたっ！`);
  }
  pages.push("気になったら元の記事も開いて、日付と書かれている内容を確かめましょうっ！");
  return pages;
}

function topicLabel(text: string) {
  const topics: Array<[RegExp, string]> = [
    [/(天気|気温|台風|大雨|地震|災害|雪|猛暑)/u, "天気や安全"],
    [/(選挙|政府|国会|首相|大統領|法律|自治体)/u, "社会や政治"],
    [/(株|市場|経済|企業|物価|円相場|金融)/u, "経済"],
    [/(AI|人工知能|技術|科学|宇宙|アプリ|コンピュータ)/iu, "科学や技術"],
    [/(試合|優勝|選手|大会|リーグ|スポーツ)/u, "スポーツ"],
    [/(映画|音楽|本|作品|芸術|文化)/u, "文化"],
    [/(病院|医療|健康|感染|薬)/u, "健康"],
    [/(電車|鉄道|道路|交通|空港|運休)/u, "交通"]
  ];
  return topics.find(([pattern]) => pattern.test(text))?.[1] ?? "世の中の出来事";
}
