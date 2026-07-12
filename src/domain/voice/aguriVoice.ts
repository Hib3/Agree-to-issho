import type { CharacterEmotion } from "../model/character";

export function applyAguriVoice(text: string, emotion: CharacterEmotion = "curious") {
  const clean = text.trim();
  if (!clean) return clean;
  const energetic = clean
    .replace(/でしょう。/g, "でしょうねェっ！")
    .replace(/ですね。/g, "ですねェっ！")
    .replace(/です。/g, "でェっすっ！")
    .replace(/ます。/g, "まァっすっ！")
    .replace(/ません。/g, "ませんねェっ！")
    .replace(/ですか(?:っ)?[？?]?/g, "ですかっ！？")
    .replace(/ますか(?:っ)?[？?]?/g, "ますかっ！？")
    .replace(/かな。/g, "かなァっ！")
    .replace(/よね。/g, "よなァっ！")
    .replace(/っ。/g, "っ！");
  const prefix = prefixFor(emotion, energetic);
  const ending = /[。！？!?]$/u.test(energetic) ? "" : endingFor(energetic, emotion);
  return `${prefix}${energetic}${ending}`;
}

function prefixFor(emotion: CharacterEmotion, text: string) {
  if (/^(まァっ|なんかっ|あのっ|えェっ)/.test(text)) return "";
  if (emotion === "confused" || emotion === "embarrassed") return "なんかっ、";
  if (emotion === "excited" || emotion === "happy") return "まァっ、";
  if (emotion === "sleepy" || emotion === "calm") return "あのっ、";
  return hash(text) % 2 === 0 ? "まァっ、" : "なんかっ、";
}

function endingFor(text: string, emotion: CharacterEmotion) {
  const endings = emotion === "confused"
    ? [" かもしれませんねェっ！", " ちょっと気になりますなァっ！"]
    : emotion === "happy" || emotion === "excited"
      ? [" めっちゃいいなァっ！", " うれしいよォっ！"]
      : [" ですねェっ！", " だよなァっ！", " もっと知りたいよォっ！"];
  return endings[hash(text) % endings.length] ?? " ですねェっ！";
}

function hash(text: string) {
  return Array.from(text).reduce((value, character) => (value * 31 + character.codePointAt(0)!) >>> 0, 7);
}
