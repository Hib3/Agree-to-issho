import { expect, test, type Page } from "@playwright/test";

async function enterRoom(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "はじめまして" }).click();
  await page.getByRole("textbox", { name: "あなたの名前" }).fill("ニューステスト");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "最初の言葉を教える" }).click();
  await page.getByRole("textbox", { name: "教える言葉" }).fill("銀河案内板");
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

async function registerFeed(page: Page, feedUrl: string, expectedNewsCount = 1) {
  await page.getByRole("button", { name: "設定" }).click();
  await page.getByRole("checkbox", { name: "ニュース機能を使う" }).check();
  const autonomous = page.getByRole("checkbox", { name: "アグリちゃんから話しかける" });
  if (await autonomous.isChecked()) await autonomous.uncheck();
  await page.getByRole("textbox", { name: "サイトまたはRSSのURL" }).fill(feedUrl);
  await page.getByRole("button", { name: "探して追加" }).click();
  await page.getByRole("button", { name: "このRSSを追加" }).click();
  await expect(page.getByRole("status")).toContainText(`新しいニュースを${expectedNewsCount}件保存しました`);
  await page.getByRole("button", { name: "部屋へ戻る" }).click();
  const invitation = page.getByRole("button", { name: "ニュースを見る", exact: true });
  if (await invitation.isVisible()) await invitation.click();
  else await page.getByRole("button", { name: /^ニュース(?: \d+)?$/u }).click();
}

async function advanceToChoice(page: Page, choiceName: string) {
  const choice = page.getByRole("button", { name: choiceName });
  for (let index = 0; index < 10; index += 1) {
    const next = page.getByRole("button", { name: "会話を続ける" });
    await expect.poll(async () => (await choice.isVisible()) || (await next.isEnabled())).toBe(true);
    if (await choice.isVisible()) return;
    await next.click();
  }
  await expect(choice).toBeVisible();
}

test("CORS consent leads into a reload-safe normal news conversation", async ({ page }) => {
  const feedUrl = "https://news.example.test/news.xml";
  const articleUrl = "https://news.example.test/articles/train-display";
  await page.route(feedUrl, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/rss+xml",
      headers: { "access-control-allow-origin": "*" },
      body: `<?xml version="1.0"?><rss version="2.0"><channel><title>交通だより</title><item><guid>train-display</guid><title>三つの駅で銀河案内板を試験</title><link>${articleUrl}</link><pubDate>Mon, 13 Jul 2026 09:00:00 GMT</pubDate><description>交通局が三つの駅で銀河案内板を試すと発表した。</description></item></channel></rss>`
    })
  );
  await page.route(articleUrl, (route) => route.abort("failed"));
  await page.route("https://r.jina.ai/**", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain",
      headers: { "access-control-allow-origin": "*" },
      body: [
        "Title: 三つの駅で案内表示を試験",
        "Markdown Content:",
        "交通局は三つの駅で銀河案内板を試すと発表しました。試験は七月から始まり、利用者の反応を確認します。",
        "新しい表示は日本語と英語に対応し、迷いやすい改札付近から順番に設置される予定です。"
      ].join("\n")
    })
  );

  await enterRoom(page);
  await registerFeed(page, feedUrl);
  await page.getByRole("button", { name: "アグリと話す" }).click();
  await expect(page.getByRole("heading", { name: "この記事は直接開けませんでした" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "今回だけ許可" })).toBeVisible();
  await page.getByRole("button", { name: "今回だけ許可" }).click();

  await expect(page.getByText("ニュースの記事について会話中")).toBeVisible();
  await expect(page.getByRole("link", { name: "元記事" })).toHaveAttribute("href", articleUrl);
  await advanceToChoice(page, "少し違うと思う");
  await page.getByRole("button", { name: "少し違うと思う" }).click();
  await page.getByRole("button", { name: "この返事にする" }).click();
  await expect(page.locator(".dialogue-box")).toContainText("受け取り方が違う");

  await page.reload();
  await expect(page.locator(".dialogue-box")).toContainText("受け取り方が違う");
  await page.getByRole("button", { name: "会話を続ける" }).click();
  await expect(page.getByRole("button", { name: "話す", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^ニュース(?: \d+)?$/u }).click();
  await expect(page.locator(".news-item").filter({ hasText: "三つの駅" })).toContainText("会話済み");
});

test("helper refusal starts a headline-only conversation without pretending to read the body", async ({
  page
}) => {
  const feedUrl = "https://headline.example.test/news.xml";
  const articleUrl = "https://headline.example.test/articles/weather";
  await page.route(feedUrl, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/rss+xml",
      headers: { "access-control-allow-origin": "*" },
      body: `<?xml version="1.0"?><rss version="2.0"><channel><title>見出し通信</title><item><guid>weather</guid><title>市が週末の交通計画を発表</title><link>${articleUrl}</link><pubDate>Mon, 13 Jul 2026 09:00:00 GMT</pubDate></item></channel></rss>`
    })
  );
  await page.route(articleUrl, (route) => route.abort("failed"));

  await enterRoom(page);
  await registerFeed(page, feedUrl);
  await page.getByRole("button", { name: "アグリと話す" }).click();
  await page.getByRole("button", { name: /許可しない/ }).click();
  await expect(page.getByText("ニュースの記事について会話中")).toBeVisible();
  await advanceToChoice(page, "見出しだけでも話す");
  await expect(page.locator(".dialogue-box")).toContainText("見出しだけ");
  await expect(page.locator(".dialogue-box")).not.toContainText("本文では");
});

test("an active ordinary conversation blocks news without closing the news shelf", async ({ page }) => {
  const feedUrl = "https://busy.example.test/news.xml";
  const articleUrl = "https://busy.example.test/articles/update";
  await page.route(feedUrl, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/rss+xml",
      headers: { "access-control-allow-origin": "*" },
      body: `<?xml version="1.0"?><rss version="2.0"><channel><title>暮らし通信</title><item><guid>update</guid><title>駅前広場の工事日程を更新</title><link>${articleUrl}</link><pubDate>Mon, 13 Jul 2026 09:00:00 GMT</pubDate></item></channel></rss>`
    })
  );
  await page.route(articleUrl, (route) => route.abort("failed"));

  await enterRoom(page);
  await registerFeed(page, feedUrl);
  await page.getByRole("button", { name: "部屋へ戻る" }).click();
  await page.getByRole("button", { name: "話す", exact: true }).click();
  await expect(page.getByRole("button", { name: "会話を続ける" })).toBeVisible();
  await page.getByRole("button", { name: /^ニュース(?: \d+)?$/u }).click();
  await page.getByRole("button", { name: "アグリと話す" }).click();
  await page.getByRole("button", { name: /許可しない/ }).click();

  await expect(page.getByRole("heading", { name: "ニュース" })).toBeVisible();
  await expect(page.getByText("今の会話を終えてから、ニュースを選んでください。")).toBeVisible();
  await expect(page.getByText("ニュースの記事について会話中")).toHaveCount(0);
});

test("cancelling helper consent keeps the article unread and creates no conversation", async ({ page }) => {
  const feedUrl = "https://cancel.example.test/news.xml";
  const articleUrl = "https://cancel.example.test/articles/one";
  await page.route(feedUrl, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/rss+xml",
      headers: { "access-control-allow-origin": "*" },
      body: `<?xml version="1.0"?><rss version="2.0"><channel><title>確認通信</title><item><guid>one</guid><title>駅前の予定を発表</title><link>${articleUrl}</link><pubDate>Mon, 13 Jul 2026 09:00:00 GMT</pubDate></item></channel></rss>`
    })
  );
  await page.route(articleUrl, (route) => route.abort("failed"));

  await enterRoom(page);
  await registerFeed(page, feedUrl);
  await page.getByRole("button", { name: "アグリと話す" }).click();
  await expect(page.getByRole("heading", { name: "この記事は直接開けませんでした" })).toBeVisible();
  await page.getByRole("button", { name: "キャンセル" }).click();

  await expect(page.getByRole("heading", { name: "この記事は直接開けませんでした" })).toHaveCount(0);
  await expect(page.locator(".news-item").filter({ hasText: "駅前の予定" })).toContainText("未読");
  await expect(page.getByText("ニュースの記事について会話中")).toHaveCount(0);
});

test("selecting another article aborts stale preparation and keeps the latest article selected", async ({
  page
}) => {
  const feedUrl = "https://switch.example.test/news.xml";
  const firstUrl = "https://switch.example.test/articles/first";
  const secondUrl = "https://switch.example.test/articles/second";
  await page.route(feedUrl, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/rss+xml",
      headers: { "access-control-allow-origin": "*" },
      body: `<?xml version="1.0"?><rss version="2.0"><channel><title>切替通信</title><item><guid>first</guid><title>一つ目の予定</title><link>${firstUrl}</link><pubDate>Mon, 13 Jul 2026 10:00:00 GMT</pubDate></item><item><guid>second</guid><title>二つ目の予定</title><link>${secondUrl}</link><pubDate>Mon, 13 Jul 2026 09:00:00 GMT</pubDate></item></channel></rss>`
    })
  );
  await page.route(firstUrl, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      headers: { "access-control-allow-origin": "*" },
      body: "<article><p>一つ目の記事では駅前の予定を更新すると発表しました。詳しい日程は七月から確認され、利用者へ案内される予定です。</p><p>工事中も通路を確保し、週末ごとに進み方を見直します。</p></article>"
    });
  });
  await page.route(secondUrl, (route) => route.abort("failed"));

  await enterRoom(page);
  await registerFeed(page, feedUrl, 2);
  const talkButtons = page.getByRole("button", { name: "アグリと話す" });
  await talkButtons.nth(0).click();
  await expect(page.getByRole("heading", { name: "アグリが記事を読んでいます…" })).toBeVisible();
  await talkButtons.nth(1).click();
  await expect(page.getByRole("heading", { name: "この記事は直接開けませんでした" })).toBeVisible();
  await expect(page.locator(".news-preparation")).toContainText("二つ目の予定");
  await page.waitForTimeout(900);
  await expect(page.locator(".news-preparation")).toContainText("二つ目の予定");
});

test("an active headline-only news conversation restores while offline", async ({ page, context }) => {
  const feedUrl = "https://offline.example.test/news.xml";
  const articleUrl = "https://offline.example.test/articles/one";
  await page.route(feedUrl, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/rss+xml",
      headers: { "access-control-allow-origin": "*" },
      body: `<?xml version="1.0"?><rss version="2.0"><channel><title>端末通信</title><item><guid>offline</guid><title>週末の交通予定を更新</title><link>${articleUrl}</link><pubDate>Mon, 13 Jul 2026 09:00:00 GMT</pubDate></item></channel></rss>`
    })
  );
  await page.route(articleUrl, (route) => route.abort("failed"));

  await enterRoom(page);
  await registerFeed(page, feedUrl);
  await page.getByRole("button", { name: "アグリと話す" }).click();
  await page.getByRole("button", { name: /許可しない/ }).click();
  await expect(page.getByText("ニュースの記事について会話中")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return true;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
    await expect(page.getByText("ニュースの記事について会話中")).toBeVisible();
  }

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("ニュースの記事について会話中")).toBeVisible();
    await advanceToChoice(page, "見出しだけでも話す");
    await expect(page.locator(".dialogue-box")).toContainText("見出し");
  } finally {
    await context.setOffline(false);
  }
});
