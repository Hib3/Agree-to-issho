import { expect, test } from "@playwright/test";

test("初回設定から学習語を使う会話まで進める", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "はじめまして" }).click();
  await page.getByRole("textbox", { name: "あなたの名前" }).fill("テストプレイヤー");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "最初の言葉を教える" }).click();

  await page.getByRole("textbox", { name: "教える言葉" }).fill("星形クッキー");
  await page.getByRole("button", { name: "この言葉を教える" }).click();
  await page.getByRole("button", { name: "食べ物・生き物" }).click();
  await page.getByRole("button", { name: "食べ物・飲み物" }).click();
  await page.getByRole("button", { name: "食べる" }).click();
  await page.getByRole("button", { name: "大好き" }).click();
  await page.getByRole("button", { name: "この覚え方で保存" }).click();
  await page.getByRole("button", { name: "部屋へ戻る" }).click();

  await expect(page.getByRole("button", { name: "話す" })).toBeVisible();
  await expect(page.getByRole("button", { name: "言葉を教える" })).toBeVisible();
  await page.getByRole("button", { name: "話す" }).click();
  const reveal = page.getByRole("button", { name: "全文を表示" });
  if (await reveal.isVisible()) await reveal.click();
  await expect(page.getByText(/星形クッキー/u)).toBeVisible();
  await expect(page.getByRole("button", { name: "会話を続ける" })).toBeVisible();
});
