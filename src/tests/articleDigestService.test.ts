import { afterEach, describe, expect, it, vi } from "vitest";
import type { NewsItem } from "../domain/model/news";
import {
  assessArticleText,
  buildFeedDigest,
  fetchArticleDigest,
  findReaderArticleUrl
} from "../infrastructure/news/articleDigestService";

const now = 1_700_000_000_000;
const item: NewsItem = {
  id: "news_article",
  feedId: "feed_article",
  sourceName: "町の通信",
  title: "三つの駅で案内表示を試験",
  summary: "交通局は三つの駅で新しい案内表示を試すと発表した。",
  url: "https://example.com/article",
  publishedAt: now,
  fetchedAt: now
};

const usefulArticle = [
  "交通局は三つの駅で新しい案内表示を試すと発表しました。試験は七月から始まり、利用者の反応を確認します。",
  "新しい表示は日本語と英語に対応し、迷いやすい改札付近から順番に設置される予定です。"
].join("");

afterEach(() => vi.unstubAllGlobals());

describe("article digest service", () => {
  it("keeps a compact feed digest", () => {
    const digest = buildFeedDigest(item, now);
    expect(digest.contentLevel).toBe("feed_summary");
    expect(digest.keyFacts[0]?.text).toBe(item.summary);
    expect(digest.confidence).toBeLessThan(0.6);
  });

  it("does not fetch when RSS content is informative", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchArticleDigest(
      { ...item, feedContent: usefulArticle },
      {
        useArticleHelper: false,
        now
      }
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.digest.contentLevel).toBe("feed_content");
    expect(result.trace.attempts[0]).toMatchObject({ method: "feed_content", result: "success" });
  });

  it("continues to article fetch when RSS content nearly duplicates the headline", async () => {
    const html = `<article><p>${usefulArticle}</p></article>`;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(html, { status: 200, headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchArticleDigest(
      { ...item, feedContent: `${item.title}。${item.title}。` },
      { useArticleHelper: false, now }
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.trace.attempts[0]).toMatchObject({ method: "feed_content", result: "too_short" });
    expect(result.digest.contentLevel).toBe("article_extract");
  });

  it("extracts article paragraphs while excluding navigation and advertisements", async () => {
    const html = `<html><body><nav>メニューの説明がここに長く並んでいます。</nav><article><h1>${item.title}</h1><p>${usefulArticle}</p><div class="advertisement"><p>広告の商品説明は根拠にしてはいけません。広告サービスへ登録してください。</p></div></article></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(html, { status: 200, headers: { "content-type": "text/html" } }))
    );
    const result = await fetchArticleDigest(item, { useArticleHelper: false, now });
    expect(result.digest.contentLevel).toBe("article_extract");
    expect(result.digest.keyFacts.map((fact) => fact.text).join(" ")).toContain("七月");
    expect(result.digest.keyFacts.map((fact) => fact.text).join(" ")).not.toContain("広告");
    expect(result.trace.attempts).toContainEqual(
      expect.objectContaining({ method: "direct_article", result: "success", statusCode: 200 })
    );
  });

  it("requests consent after a CORS failure when helper is off", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("CORS"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchArticleDigest(item, { useArticleHelper: false, now });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.needsHelperConsent).toBe(true);
    expect(result.digest.contentLevel).toBe("feed_summary");
    expect(result.trace.attempts).toContainEqual(
      expect.objectContaining({ method: "direct_article", result: "cors_error" })
    );
    expect(result.trace.attempts).toContainEqual(
      expect.objectContaining({ method: "reader_helper", result: "disabled" })
    );
  });

  it("uses the article helper only after explicit consent", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("CORS"))
      .mockResolvedValueOnce(
        new Response(`Title: 記事\nMarkdown Content:\n## 本文\n${usefulArticle}`, {
          status: 200,
          headers: { "content-type": "text/plain" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const first = await fetchArticleDigest(item, { useArticleHelper: false, now });
    const result = await fetchArticleDigest(item, {
      useArticleHelper: true,
      attemptDirect: false,
      previousTrace: first.trace,
      now
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`https://r.jina.ai/${item.url}`);
    expect(result.digest.contentLevel).toBe("article_extract");
    expect(result.needsHelperConsent).toBe(false);
    expect(result.trace.attempts.filter((attempt) => attempt.method === "fallback_headline")).toHaveLength(0);
  });

  it("follows one explicit full-article link and excludes portal strings", async () => {
    const pickupUrl = "https://news.example.test/pickup/123";
    const articleUrl = "https://news.example.test/articles/full-123";
    const pickup = [
      "Title: ニュース一覧",
      `URL Source: ${pickupUrl}`,
      "Markdown Content:",
      "Yahoo! JAPAN ヘルプ ウェブ検索 マイページの記事一覧です。",
      `[別の記事](https://news.example.test/articles/unrelated)`,
      `[記事全文を読む](${articleUrl})`,
      "ランキングの記事をもっと見る。ニュース一覧を更新しました。"
    ].join("\n");
    const article = [
      `Title: ${item.title}`,
      `URL Source: ${articleUrl}`,
      "Markdown Content:",
      `# ${item.title}`,
      "コメント 23 件",
      "交通局は七月から三つの駅で新しい表示を試し、利用者の反応を調べると発表しました。[【写真で見る】駅の表示](https://images.example.test/gallery)",
      "試験結果は九月に市の会議で詳しく報告され、利用者の意見を踏まえて今後の設置場所を決める予定です。",
      "この記事はいかがでしたか？",
      "関連記事のランキングを表示します。"
    ].join("\n");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(pickup, { status: 200 }))
      .mockResolvedValueOnce(new Response(article, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchArticleDigest(
      { ...item, url: pickupUrl },
      {
        useArticleHelper: true,
        attemptDirect: false,
        now
      }
    );

    expect(fetchMock).toHaveBeenNthCalledWith(1, `https://r.jina.ai/${pickupUrl}`, expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, `https://r.jina.ai/${articleUrl}`, expect.any(Object));
    expect(result.digest.contentLevel).toBe("article_extract");
    expect(result.digest.sourceUrl).toBe(articleUrl);
    const facts = result.digest.keyFacts.map((fact) => fact.text).join(" ");
    expect(facts).toContain("七月");
    expect(facts).not.toMatch(
      /Yahoo|ランキング|記事全文|写真で見る|https?:|Markdown Content|\[object Object\]/u
    );
    expect(result.trace.attempts.filter((attempt) => attempt.method === "reader_helper")).toHaveLength(2);
  });

  it("does not follow an unrelated article link from a landing page", () => {
    const markdown = [
      "Markdown Content:",
      "[注目の記事](https://example.com/unrelated)",
      "記事の一覧だけを表示しています。"
    ].join("\n");
    expect(findReaderArticleUrl(markdown, item.url)).toBeUndefined();
  });

  it.each([
    {
      name: "GIGAZINE-like article",
      markdown: [
        `Title: ${item.title}`,
        "Markdown Content:",
        `# ${item.title}`,
        "![Image 18](https://images.example.test/news.jpg)",
        "交通局は三つの駅で新しい案内表示を試すことを発表しました。利用者の反応を七月から確認します。",
        "**[発表資料](https://example.test/source)**",
        "市は試験の結果を九月に詳しく公表し、利用者の意見を踏まえて次の設置場所を検討する予定です。"
      ].join("\n")
    },
    {
      name: "Lifehacker-like article",
      markdown: [
        `Title: ${item.title}`,
        "Markdown Content:",
        "* [](https://social.example.test/share)",
        `# ${item.title}`,
        "Buy PR",
        "2026.07.14 lastupdate",
        "Advertisement",
        "* [](https://social.example.test/share-again)",
        "新しい案内表示を気軽に使いたい人へ向けて、交通局が三つの駅で試験を始めると発表しました。",
        "表示は日本語と英語に対応し、七月から利用者の反応を確認して今後の設置場所を検討する予定です。"
      ].join("\n")
    }
  ])("extracts prose from $name without markdown or sharing strings", async ({ markdown }) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(markdown, { status: 200 })));
    const result = await fetchArticleDigest(item, { useArticleHelper: true, attemptDirect: false, now });
    const facts = result.digest.keyFacts.map((fact) => fact.text).join(" ");
    expect(result.digest.contentLevel).toBe("article_extract");
    expect(facts).toContain("交通局");
    expect(facts).not.toMatch(/Advertisement|Buy PR|https?:|\*\*|Image 18/u);
  });

  it("rejects reader output made only of navigation and internal strings", async () => {
    const markdown = [
      "Title: ニュースポータル",
      "URL Source: https://portal.example.test/",
      "Markdown Content:",
      "Yahoo! JAPAN ヘルプ ウェブ検索 マイページの記事一覧です。",
      "ランキングのニュース記事をもっと見る。ニュース一覧を更新しました。",
      "[object Object] undefined"
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(markdown, { status: 200 })));
    const result = await fetchArticleDigest(item, { useArticleHelper: true, attemptDirect: false, now });
    expect(result.digest.contentLevel).toBe("feed_summary");
    expect(result.trace.attempts).toContainEqual(
      expect.objectContaining({ method: "reader_helper", result: "too_short" })
    );
    expect(JSON.stringify(result.digest)).not.toMatch(/\[object Object\]|undefined|Yahoo! JAPAN/u);
  });

  it("keeps the fallback and records a helper HTTP failure", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("CORS"))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchArticleDigest(item, { useArticleHelper: true, now });
    expect(result.digest.contentLevel).toBe("feed_summary");
    expect(result.needsHelperConsent).toBe(false);
    expect(result.trace.attempts).toContainEqual(
      expect.objectContaining({ method: "reader_helper", result: "http_error", statusCode: 503 })
    );
  });

  it("rejects an article body that is too short", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("短い本文です。")));
    const result = await fetchArticleDigest(item, { useArticleHelper: false, now });
    expect(result.needsHelperConsent).toBe(true);
    expect(result.trace.attempts).toContainEqual(
      expect.objectContaining({ method: "direct_article", result: "too_short" })
    );
  });

  it.each([
    "Cookieを許可してください。プライバシー設定を確認してください。Cookie通知を許可してください。利用規約をご確認ください。",
    "広告サービスへ登録してください。広告を表示しています。会員登録すると広告を消せます。サイトについて詳しく紹介します。"
  ])("rejects boilerplate-only text", (text) => {
    expect(assessArticleText(text.repeat(2), item.title).useful).toBe(false);
  });

  it("falls back without retaining an oversized article", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("large", { status: 200, headers: { "content-length": "1000001" } }))
    );
    const result = await fetchArticleDigest(item, { useArticleHelper: false, now });
    expect(result.digest.contentLevel).toBe("feed_summary");
    expect(JSON.stringify(result.digest).length).toBeLessThan(10_000);
  });
});
