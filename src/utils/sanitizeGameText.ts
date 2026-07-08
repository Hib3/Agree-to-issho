const blockedPatterns = [
  /DebugPanel/i,
  /api[_-]?tool/i,
  /schema[_-]?version/i,
  /app[_-]?id/i,
  /IndexedDB/i,
  /デバッグ/
];

export function sanitizeGameText(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !blockedPatterns.some((pattern) => pattern.test(line)))
    .join("\n")
    .trim();
}
