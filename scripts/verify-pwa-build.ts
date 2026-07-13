import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const serviceWorkerPath = join(dist, "sw.js");
const errors: string[] = [];

if (!existsSync(serviceWorkerPath)) {
  errors.push("dist/sw.js is missing");
} else {
  const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
  const urls = [...serviceWorker.matchAll(/\{url:"([^"]+)"/gu)].map((match) => match[1]!);
  const duplicates = [...new Set(urls.filter((url, index) => urls.indexOf(url) !== index))];
  if (urls.length === 0) errors.push("service worker precache manifest is empty");
  for (const duplicate of duplicates) errors.push(`duplicate precache URL: ${duplicate}`);
  for (const url of urls) {
    if (/^https?:/u.test(url)) continue;
    const relativePath = url.split("?", 1)[0];
    if (relativePath && !existsSync(join(dist, relativePath))) errors.push(`missing precache file: ${relativePath}`);
  }
  if (urls.filter((url) => url.endsWith("aguri_normal.png")).length !== 1) {
    errors.push("PWA icon must occur exactly once in the precache manifest");
  }
  if (!serviceWorker.includes('createHandlerBoundToURL("index.html")')) {
    errors.push("service worker has no navigation fallback route");
  }

  if (errors.length === 0) console.log(`PWA build verified: ${urls.length} unique precache entries`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
