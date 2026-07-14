import { describe, expect, it } from "vitest";
import { parseReaderMarkdown, parseRss2Json, parseRssXml } from "../domain/news/rssParser";

const now = 1_700_000_000_000;

describe("RSS parsing", () => {
  it("reads RSS without retaining article-sized HTML", () => {
    const description = `<p>${"長い説明".repeat(100)}</p>`;
    const parsed = parseRssXml(
      `<?xml version="1.0"?><rss version="2.0"><channel><title>町の通信</title><item><title>駅前に新しい時計</title><link>https://example.com/news/1</link><guid>one</guid><pubDate>Tue, 14 Nov 2023 12:00:00 GMT</pubDate><description><![CDATA[${description}]]></description></item></channel></rss>`,
      "feed_one",
      "https://example.com/feed.xml",
      now
    );
    expect(parsed.title).toBe("町の通信");
    expect(parsed.items[0]?.title).toBe("駅前に新しい時計");
    expect(parsed.items[0]?.summary).not.toContain("<p>");
    expect(Array.from(parsed.items[0]?.summary ?? "").length).toBeLessThanOrEqual(240);
  });

  it("reads Atom alternate links", () => {
    const parsed = parseRssXml(
      `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>科学便り</title><entry><id>tag:example,1</id><title>宇宙観測を更新</title><link rel="alternate" href="https://example.com/space"/><updated>2026-07-13T00:00:00Z</updated><summary>新しい観測結果を公開した。</summary></entry></feed>`,
      "feed_atom",
      "https://example.com/atom.xml",
      now
    );
    expect(parsed.items[0]?.url).toBe("https://example.com/space");
    expect(parsed.items[0]?.summary).toBe("新しい観測結果を公開した。");
  });

  it("reads RDF, namespaced content and xml:base without duplicating URLs", () => {
    const parsed = parseRssXml(
      `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xml:base="https://example.com/news/"><channel><title>町のRDF</title></channel><item><title>一つ目</title><link>one</link><content:encoded><![CDATA[<p>詳しい配信内容</p>]]></content:encoded></item><item><title>重複</title><link>one#fragment</link></item></rdf:RDF>`,
      "feed_rdf",
      "https://example.com/feed.rdf",
      now
    );
    expect(parsed.format).toBe("rdf");
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      url: "https://example.com/news/one",
      feedContent: "詳しい配信内容"
    });
  });

  it("marks missing, invalid and future dates instead of presenting them as feed dates", () => {
    const parsed = parseRssXml(
      `<?xml version="1.0"?><rss version="2.0"><channel><title>日時</title><item><title>なし</title><link>https://example.com/none</link></item><item><title>不正</title><link>https://example.com/bad</link><pubDate>not-a-date</pubDate></item><item><title>未来</title><link>https://example.com/future</link><pubDate>2099-01-01T00:00:00Z</pubDate></item></channel></rss>`,
      "feed_dates",
      "https://example.com/feed.xml",
      now
    );
    expect(parsed.items.map((item) => item.dateStatus)).toEqual(["missing", "invalid", "future"]);
    expect(parsed.items.every((item) => item.publishedAt === now)).toBe(true);
  });

  it("rejects HTML and JSON responses as unsupported feed formats", () => {
    expect(() =>
      parseRssXml("<html><body>error</body></html>", "feed_html", "https://example.com/feed", now)
    ).toThrow("いずれでもありません");
    expect(() =>
      parseRssXml(
        '{"version":"https://jsonfeed.org/version/1.1"}',
        "feed_json",
        "https://example.com/feed",
        now
      )
    ).toThrow("XML形式");
  });

  it("accepts the documented RSS-to-JSON response shape", () => {
    const parsed = parseRss2Json(
      {
        status: "ok",
        feed: { title: "交通情報" },
        items: [
          {
            guid: "x",
            title: "列車の運行情報",
            link: "https://example.com/train",
            description: "一部区間の運行を確認中。",
            pubDate: "2026-07-13 09:00:00"
          }
        ]
      },
      "feed_json",
      "https://example.com/feed",
      now
    );
    expect(parsed.items[0]?.sourceName).toBe("交通情報");
    expect(parsed.items[0]?.title).toBe("列車の運行情報");
  });

  it("never stringifies object-valued RSS helper fields into visible text", () => {
    const parsed = parseRss2Json(
      {
        status: "ok",
        feed: { title: "安全な配信元" },
        items: [
          {
            guid: "object-fields",
            title: "安全なタイトル",
            link: "https://example.com/object-fields",
            description: { text: "壊れた説明" },
            content: { html: "壊れた本文" }
          }
        ]
      },
      "feed_object_fields",
      "https://example.com/feed",
      now
    );
    const serialized = JSON.stringify(parsed);

    expect(serialized).not.toContain("[object Object]");
    expect(serialized).not.toContain("壊れた説明");
    expect(parsed.items[0]?.title).toBe("安全なタイトル");
    expect(parsed.items[0]?.summary).toBe("");
    expect(() =>
      parseRss2Json(
        {
          status: "ok",
          items: [
            {
              title: { rendered: "壊れたタイトル" },
              link: "https://example.com/object-title"
            }
          ]
        },
        "feed_object_title",
        "https://example.com/feed",
        now
      )
    ).toThrow("RSSに読める記事がありませんでした");
  });

  it("reads only compact headline metadata from Reader markdown", () => {
    const parsed = parseReaderMarkdown(
      `Title: 主要ニュース\nURL Source: https://news.example.test/feed.xml\nMarkdown Content:\n### [交通情報を更新](https://news.example.test/articles/one)\n[https://news.example.test/articles/one](https://news.example.test/articles/one)\nMon, 13 Jul 2026 01:00:00 GMT\n短い概要です。\n\n### [天気の見通し](https://news.example.test/articles/two)\nTue, 14 Jul 2026 01:00:00 GMT`,
      "feed_reader",
      "https://news.example.test/feed.xml",
      now
    );
    expect(parsed.title).toBe("主要ニュース");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toMatchObject({
      title: "交通情報を更新",
      summary: "短い概要です。",
      url: "https://news.example.test/articles/one"
    });
  });
});
