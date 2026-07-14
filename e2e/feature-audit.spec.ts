import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function enterRoom(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "はじめまして" }).click();
  await page.getByRole("textbox", { name: "あなたの名前" }).fill("機能テスト");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "最初の言葉を教える" }).click();
  await page.getByRole("textbox", { name: "教える言葉" }).fill("宇宙");
  await page.getByRole("button", { name: "この言葉を教える" }).click();
  await page.getByRole("button", { name: "考え・その他" }).click();
  await page.getByRole("button", { name: "抽象的なこと" }).click();
  await page.getByRole("button", { name: "明るい" }).click();
  await page.getByRole("button", { name: "次の質問へ" }).click();
  await page.getByRole("button", { name: "どちらでも" }).click();
  await page.getByRole("button", { name: "好みの質問へ" }).click();
  await page.getByRole("button", { name: "好き", exact: true }).click();
  await page.getByRole("button", { name: "この覚え方で保存" }).click();
  await page.getByRole("button", { name: "覚えた言葉を持って部屋へ戻る" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { __aguriSoundStarts?: number };
    state.__aguriSoundStarts = 0;
    class FakeAudioParam {
      setValueAtTime() {
        return this;
      }
      exponentialRampToValueAtTime() {
        return this;
      }
    }
    class FakeNode {
      connect() {
        return this;
      }
    }
    class FakeOscillator extends FakeNode {
      type = "sine";
      frequency = new FakeAudioParam();
      start() {
        state.__aguriSoundStarts = (state.__aguriSoundStarts ?? 0) + 1;
      }
      stop() {}
    }
    class FakeGain extends FakeNode {
      gain = new FakeAudioParam();
    }
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      createOscillator() {
        return new FakeOscillator();
      }
      createGain() {
        return new FakeGain();
      }
      resume() {
        return Promise.resolve();
      }
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
  });
});

test("settings-controlled sound and RSS news work through the player UI", async ({ page }) => {
  await page.route("https://science.example.test/", async (route) => route.abort("failed"));
  await page.route("https://feedsearch.dev/api/v1/search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify([{ url: "https://news.example.test/feed.xml", title: "科学便り", score: 10 }])
    });
  });
  await page.route("https://news.example.test/feed.xml", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/rss+xml",
      headers: { "access-control-allow-origin": "*" },
      body: `<?xml version="1.0"?><rss version="2.0"><channel><title>科学便り</title><item><guid>space-1</guid><title>宇宙観測の新しい結果</title><link>https://news.example.test/articles/space-1</link><pubDate>Mon, 13 Jul 2026 09:00:00 GMT</pubDate><description>研究チームが観測結果を公開した。</description></item></channel></rss>`
    });
  });
  await page.route("https://news.example.test/articles/space-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      headers: { "access-control-allow-origin": "*" },
      body: `<article><p>研究チームは新しい望遠鏡で宇宙観測を行い、その結果を公開しました。観測は三か月続き、複数の地点から得た記録を比較しました。</p><p>研究所は公開した記録を今後も確認し、別の観測地点で得られた結果との違いを調査する予定です。</p></article>`
    });
  });
  await enterRoom(page);

  await page.getByRole("button", { name: "設定" }).click();
  const preview = page.getByRole("button", { name: "音を試す" });
  await expect(preview).toBeEnabled();
  await preview.click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { __aguriSoundStarts?: number }).__aguriSoundStarts ?? 0)
    )
    .toBeGreaterThan(0);
  const mute = page.getByRole("checkbox", { name: "ミュート" });
  await mute.check();
  await expect(preview).toBeDisabled();
  await mute.uncheck();

  await page.getByRole("checkbox", { name: "サイトからRSSを探す補助を使う" }).check();
  await page.getByRole("textbox", { name: "サイトまたはRSSのURL" }).fill("https://science.example.test/");
  await page.getByRole("button", { name: "探して追加" }).click();
  await expect(page.getByRole("status")).toContainText("RSS候補を1件");
  await page.getByRole("button", { name: "このRSSを追加" }).click();
  await expect(page.getByRole("status")).toContainText("新しいニュースを1件保存しました");
  await page.getByRole("button", { name: "部屋へ戻る" }).click();

  const newsInvitation = page.getByRole("button", { name: "ニュースを見る", exact: true });
  if (await newsInvitation.isVisible()) await newsInvitation.click();
  else await page.getByRole("button", { name: /^ニュース(?: \d+)?$/u }).click();
  await expect(page.getByText("宇宙観測の新しい結果", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "アグリと話す" }).click();
  await expect(page.getByText("ニュースの記事について会話中")).toBeVisible();
  await expect(page.getByRole("link", { name: "元記事" })).toHaveAttribute(
    "href",
    "https://news.example.test/articles/space-1"
  );
  await expect(page.getByRole("button", { name: "会話を続ける" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("multiple RSS candidates stay selectable until the player chooses one", async ({ page }) => {
  await page.route("https://multi.example.test/", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      headers: { "access-control-allow-origin": "*" },
      body: `<link rel="alternate" type="application/rss+xml" href="/main.xml"><link rel="alternate" type="application/atom+xml" href="/comments.xml">`
    })
  );
  await page.route("https://multi.example.test/main.xml", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/rss+xml",
      headers: { "access-control-allow-origin": "*" },
      body: `<?xml version="1.0"?><rss version="2.0"><channel><title>全体通信</title><item><title>町の更新</title><link>https://multi.example.test/article</link></item></channel></rss>`
    })
  );
  await page.route("https://multi.example.test/comments.xml", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/atom+xml",
      headers: { "access-control-allow-origin": "*" },
      body: `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>コメント通信</title><entry><title>返信</title><link href="https://multi.example.test/reply"/></entry></feed>`
    })
  );
  await enterRoom(page);
  await page.getByRole("button", { name: "設定" }).click();
  await page.getByRole("textbox", { name: "サイトまたはRSSのURL" }).fill("https://multi.example.test/");
  await page.getByRole("button", { name: "探して追加" }).click();
  await expect(page.getByRole("button", { name: "このRSSを追加" })).toHaveCount(2);
  const mainCandidate = page.locator(".rss-candidate-list li").filter({ hasText: "全体通信" });
  await mainCandidate.getByRole("button", { name: "このRSSを追加" }).click();
  await expect(page.getByRole("status")).toContainText("新しいニュースを1件保存しました");
  await expect(page.getByText("全体通信", { exact: true })).toBeVisible();
  await expect(page.getByText("コメント通信", { exact: true })).toHaveCount(0);
});

test("character remains bright, layered correctly, and large while teaching", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterRoom(page);

  const stage = page.locator(".character-stage").first();
  const character = stage.locator(".character");
  await expect
    .poll(() => character.evaluate((element) => getComputedStyle(element).filter))
    .toMatch(/^(?:none|.*brightness\()/u);
  const lighting = await character.evaluate((element) => ({
    filter: getComputedStyle(element).filter,
    zIndex: Number(getComputedStyle(element).zIndex),
    overlayZIndex: Number(
      getComputedStyle(element.parentElement?.querySelector(".scene-light") as Element).zIndex
    )
  }));
  const brightness =
    lighting.filter === "none" ? 1 : Number(lighting.filter.match(/brightness\(([^)]+)\)/u)?.[1] ?? 0);
  expect(brightness).toBeGreaterThanOrEqual(1);
  expect(lighting.zIndex).toBeGreaterThan(lighting.overlayZIndex);
  const stageBox = await stage.boundingBox();
  const characterBox = await character.boundingBox();
  expect((characterBox?.height ?? 0) / (stageBox?.height ?? 1)).toBeGreaterThan(0.5);

  await page.getByRole("button", { name: "言葉を教える" }).click();
  const compactStage = page.locator(".character-stage.compact");
  await expect(compactStage.locator(".character")).toBeVisible();
  const compactStageBox = await compactStage.boundingBox();
  const compactCharacterBox = await compactStage.locator(".character").boundingBox();
  expect((compactCharacterBox?.height ?? 0) / (compactStageBox?.height ?? 1)).toBeGreaterThan(0.65);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("secondary screens remain reachable without trapping the player", async ({ page }) => {
  await enterRoom(page);
  const screens = [
    ["単語帳", "アグリの単語帳"],
    ["日記", "アグリの日記"],
    ["移動", "どこで話す？"],
    ["保存", "保存データ"],
    ["説明", "この部屋について"]
  ] as const;
  for (const [buttonName, heading] of screens) {
    await page.getByRole("button", { name: buttonName, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "部屋へ戻る" }).click();
    await expect(page.getByRole("button", { name: "話す" })).toBeVisible();
  }

  await page.getByRole("button", { name: "設定" }).click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "部屋へ戻る" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("JSON backup can be exported, validated, and imported", async ({ page }) => {
  await enterRoom(page);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "この端末のデータを書き出す" }).click()
  ]);
  const path = await download.path();
  expect(path).not.toBeNull();
  const save = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  expect(save.appId).toBe("aguri-cleanroom");
  expect(save.schemaVersion).toBe(3);
  expect(save).not.toHaveProperty("newsItems");

  await page.getByLabel("バックアップを選ぶ").setInputFiles(path);
  await expect(page.getByText("読み込み可能", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "確認して読み込む" }).click();
  await expect(page.getByRole("status")).toHaveText("バックアップを読み込みました。");
});
