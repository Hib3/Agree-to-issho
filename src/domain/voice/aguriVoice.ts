import type { CharacterEmotion } from "../model/character";

const existingOpener = /^(?:まァっ|なんかっ|あのっそのっ|あのっ|えェっ|あっ|あれっ|ねえっ)[、！！？]?/u;
const uncertaintyCue = /(かもしれ|気がし|まだ|分から|わから|迷|想像|考え|気にな|ふわふわ|たぶん|ひょっと)/u;

export function applyAguriVoice(text: string, emotion: CharacterEmotion = "curious") {
  const clean = text.trim();
  if (!clean) return clean;

  const energetic = applySentenceRhythm(clean, emotion);
  return `${softenerFor(clean, emotion)}${energetic}`;
}

function applySentenceRhythm(text: string, emotion: CharacterEmotion) {
  let result = text
    .replace(/ですか(?:っ)?[？?]/gu, "ですかっ！？")
    .replace(/ますか(?:っ)?[？?]/gu, "ますかっ！？")
    .replace(/しょうか(?:っ)?[？?]/gu, "しょうかっ！？")
    .replace(/でしょう。/gu, "でしょうねェっ！")
    .replace(/ですね。/gu, "ですねェっ！")
    .replace(/ません。/gu, "ませんっ！")
    .replace(/です。/gu, "ですっ！")
    .replace(/ます。/gu, "ますっ！")
    .replace(/かな。/gu, "かなァっ！")
    .replace(/よね。/gu, "よなァっ！")
    .replace(/っ。/gu, "っ！");

  if (!["calm", "sleepy"].includes(emotion)) result = result.replace(/。/gu, "っ！");
  if (!["。", "！", "？", "!", "?"].some((ending) => result.endsWith(ending)) && ["happy", "excited"].includes(emotion)) {
    result += "っ！";
  }
  return result;
}

function softenerFor(text: string, emotion: CharacterEmotion) {
  if (existingOpener.test(text) || /「[^」]+」/u.test(text) || !uncertaintyCue.test(text)) return "";
  const bucket = hash(`${emotion}:${text}`) % 100;

  if (emotion === "confused" || emotion === "embarrassed") {
    if (bucket < 8) return "まァっ、";
    if (bucket < 28) return "なんかっ、";
    if (bucket < 36) return "あのっそのっ、";
    return "";
  }
  if (emotion === "curious") {
    if (bucket < 4) return "まァっ、";
    if (bucket < 12) return "なんかっ、";
  }
  return "";
}

function hash(text: string) {
  return Array.from(text).reduce((value, character) => (value * 31 + character.codePointAt(0)!) >>> 0, 7);
}
