export function normalizeJapanese(input: string) {
  return Array.from(input.normalize("NFKC"))
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function duplicateKey(input: string) {
  return normalizeJapanese(input)
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s・･ー]/g, "");
}

export function safePlayerText(input: string, maxLength = 24) {
  return Array.from(normalizeJapanese(input).replace(/[<>]/g, "")).slice(0, maxLength).join("");
}
