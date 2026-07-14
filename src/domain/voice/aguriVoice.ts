import type { CharacterEmotion } from "../model/character";

const existingOpener = /^(?:まァっ|なんかっ|あのっそのっ|あのっ|えェっ|あっ|あれっ|ねえっ)[、！！？]?/u;
const uncertaintyCue = /(かもしれ|気がし|まだ|分から|わから|迷|想像|考え|気にな|ふわふわ|たぶん|ひょっと)/u;

const quietEmotions = new Set<CharacterEmotion>(["calm", "lonely", "sleepy"]);
const quotePairs = new Map([
  ["「", "」"],
  ["『", "』"]
]);

export function applyAguriVoice(text: string, emotion: CharacterEmotion = "curious") {
  const clean = text.trim();
  if (!clean) return clean;

  const energetic = transformOutsideQuotes(clean, (part, isFinal) =>
    applySentenceRhythm(part, emotion, isFinal)
  );
  return `${softenerFor(clean, emotion)}${energetic}`;
}

function applySentenceRhythm(text: string, emotion: CharacterEmotion, allowTerminalAppend = true) {
  if (!text) return text;
  const questionEnding = quietEmotions.has(emotion) ? "っ？" : "っ！？";
  let result = text
    .replace(/(です|ます|でした|ました|ません)か(?:っ)?[？！?!]+/gu, `$1か${questionEnding}`)
    .replace(/しょうか(?:っ)?[？！?!]+/gu, `しょうか${questionEnding}`);

  result = result.replace(/[？！?!]+/gu, (marks) => {
    if (!/[？?]/u.test(marks)) return "！";
    return quietEmotions.has(emotion) ? "？" : "！？";
  });

  if (quietEmotions.has(emotion)) return result;

  result = result
    .replace(/でしょう。/gu, "でしょうっ！")
    .replace(/ですね。/gu, "ですねェっ！")
    .replace(/ません。/gu, "ませんっ！")
    .replace(/です。/gu, "ですっ！")
    .replace(/ます。/gu, "ますっ！")
    .replace(/かな。/gu, "かなァっ！")
    .replace(/よね。/gu, "よねェっ！")
    .replace(/っ。/gu, "っ！");

  result = result.replace(/。/gu, "っ！");
  if (
    allowTerminalAppend &&
    !["。", "！", "？", "!", "?"].some((ending) => result.endsWith(ending)) &&
    ["happy", "excited"].includes(emotion)
  ) {
    result += "っ！";
  }
  return result;
}

function transformOutsideQuotes(text: string, transform: (part: string, isFinal: boolean) => string) {
  const segments: Array<{ text: string; protected: boolean }> = [];
  let unquoted = "";
  let quoted = "";
  const expectedClosers: string[] = [];

  const flushUnquoted = () => {
    if (unquoted) segments.push({ text: unquoted, protected: false });
    unquoted = "";
  };
  const flushQuoted = () => {
    if (quoted) segments.push({ text: quoted, protected: true });
    quoted = "";
  };

  for (const character of text) {
    const closer = quotePairs.get(character);
    if (expectedClosers.length === 0) {
      if (closer) {
        flushUnquoted();
        expectedClosers.push(closer);
        quoted += character;
      } else {
        unquoted += character;
      }
      continue;
    }

    quoted += character;
    if (closer) {
      expectedClosers.push(closer);
    } else if (character === expectedClosers.at(-1)) {
      expectedClosers.pop();
      if (expectedClosers.length === 0) flushQuoted();
    }
  }

  if (expectedClosers.length > 0) return text;
  flushUnquoted();
  return segments
    .map((segment, index) =>
      segment.protected ? segment.text : transform(segment.text, index === segments.length - 1)
    )
    .join("");
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
