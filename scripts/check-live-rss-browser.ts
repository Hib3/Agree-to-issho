import { chromium, type Page } from "@playwright/test";

const publicOrigin = process.env.LIVE_APP_URL ?? "https://hib3.github.io/Agree-to-issho/";
const feeds = {
  yahoo: "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
  gigazine: "https://gigazine.net/news/rss_2.0/",
  lifehacker: "https://www.lifehacker.jp/feed/index.xml"
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(publicOrigin, { waitUntil: "domcontentloaded", timeout: 30_000 });

const results = [];
for (const [name, url] of Object.entries(feeds)) {
  results.push(await browserFetch(page, `direct:${name}`, url, "xml"));
}
results.push(await browserFetch(page, "direct:berss-feed-finder", "https://berss.com/feed", "html"));
results.push(
  await browserFetch(
    page,
    "rss2json:yahoo",
    `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feeds.yahoo)}`,
    "json"
  )
);
results.push(
  await browserFetch(
    page,
    "rss2json:gigazine",
    `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feeds.gigazine)}`,
    "json"
  )
);
results.push(
  await browserFetch(
    page,
    "rss2json:lifehacker",
    `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feeds.lifehacker)}`,
    "json"
  )
);
results.push(await browserFetch(page, "jina:yahoo", `https://r.jina.ai/${feeds.yahoo}`, "markdown"));
results.push(
  await browserFetch(
    page,
    "feedsearch:gigazine",
    `https://feedsearch.dev/api/v1/search?url=${encodeURIComponent("https://gigazine.net/")}&info=true&favicon=false&opml=false`,
    "json"
  )
);

await browser.close();
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), publicOrigin, results }, null, 2));

const required = new Map(results.map((result) => [result.name, result]));
for (const name of ["rss2json:gigazine", "rss2json:lifehacker", "jina:yahoo", "feedsearch:gigazine"]) {
  if (!required.get(name)?.ok) throw new Error(`live RSS helper check failed: ${name}`);
}

async function browserFetch(
  page: Page,
  name: string,
  url: string,
  kind: "xml" | "html" | "json" | "markdown"
) {
  return page.evaluate(
    async ({ name: checkName, url: target, kind: responseKind }) => {
      try {
        const response = await fetch(target, { cache: "no-store", credentials: "omit" });
        const text = await response.text();
        let entries = 0;
        let apiStatus = "";
        if (responseKind === "xml") {
          const document = new DOMParser().parseFromString(text, "application/xml");
          entries = document.querySelectorAll("item, entry").length;
        } else if (responseKind === "markdown") {
          entries = Array.from(text.matchAll(/^#{2,4}\s+\[[^\]]+\]\(https?:\/\//gimu)).length;
        } else if (responseKind === "json") {
          try {
            const data = JSON.parse(text) as
              { status?: string; items?: unknown[]; result?: unknown[] } | unknown[];
            apiStatus = Array.isArray(data) ? "array" : (data.status ?? "");
            entries = Array.isArray(data)
              ? data.length
              : Array.isArray(data.items)
                ? data.items.length
                : Array.isArray(data.result)
                  ? data.result.length
                  : 0;
          } catch {
            apiStatus = "invalid_json";
          }
        }
        return {
          name: checkName,
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get("content-type") ?? "",
          entries,
          apiStatus,
          bytes: new Blob([text]).size
        };
      } catch (error) {
        return {
          name: checkName,
          ok: false,
          status: 0,
          contentType: "",
          entries: 0,
          apiStatus: "",
          bytes: 0,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    },
    { name, url, kind }
  );
}
