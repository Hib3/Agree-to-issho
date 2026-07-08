const blockedPatterns = [
  /DebugPanel/i,
  /api[_-]?tool/i,
  /JSON\s*schema/i,
  /system\s*prompt/i,
  /schema[_-]?version/i,
  /app[_-]?id/i,
  /IndexedDB/i,
  /TypeError|ReferenceError|SyntaxError/i,
  /stack trace/i,
  /\bundefined\b/i,
  /\bnull\b/i,
  /\bNaN\b/i,
  /\[object Object\]/i,
  /デバッグ/
];

export function sanitizeGameText(text: string): string {
  const sanitized = text
    .split(/\r?\n/)
    .filter((line) => !blockedPatterns.some((pattern) => pattern.test(line)))
    .join("\n")
    .trim();
  return sanitized || "まァっ、この話っ！ もう一回、落ち着いて選び直しますねェっ！";
}
