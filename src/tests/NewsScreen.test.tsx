import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NewsItem } from "../domain/model/news";
import { createDefaultSettings } from "../domain/settings/gameSettings";
import { NewsScreen } from "../features/news/NewsScreen";
import { db } from "../infrastructure/db/database";

const serviceMocks = vi.hoisted(() => ({
  startNewsConversation: vi.fn()
}));

vi.mock("../features/conversation/conversationService", () => ({
  startNewsConversation: serviceMocks.startNewsConversation
}));

const now = 1_720_000_000_000;
const item: NewsItem = {
  id: "news_ui",
  feedId: "feed_ui",
  sourceName: "町の通信",
  title: "三つの駅で案内表示を試す",
  summary: "交通局が三つの駅で新しい表示を試すと発表した。",
  url: "https://example.com/news/ui",
  publishedAt: now,
  fetchedAt: now,
  discussionState: "unread"
};
const settings = { ...createDefaultSettings(now), newsEnabled: true };
const helperText = [
  "交通局は三つの駅で新しい案内表示を試すと発表しました。試験は七月から始まり、利用者の反応を確認します。",
  "新しい表示は日本語と英語に対応し、迷いやすい改札付近から順番に設置される予定です。"
].join("");

function renderScreen(overrides: Partial<Parameters<typeof NewsScreen>[0]> = {}) {
  const props: Parameters<typeof NewsScreen>[0] = {
    items: [item],
    settings,
    onBack: vi.fn(),
    onOpenSettings: vi.fn(),
    onRefresh: vi.fn().mockResolvedValue(undefined),
    onChanged: vi.fn().mockResolvedValue(undefined),
    onConversationStarted: vi.fn(),
    ...overrides
  };
  return { ...render(<NewsScreen {...props} />), props };
}

beforeEach(async () => {
  vi.spyOn(console, "debug").mockImplementation(() => undefined);
  sessionStorage.clear();
  serviceMocks.startNewsConversation.mockReset().mockResolvedValue({ id: "news_session" });
  await db.delete();
  await db.open();
  await db.settings.put(settings);
  await db.newsItems.put(item);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await db.delete();
});

describe("NewsScreen article preparation", () => {
  it("shows consent after CORS without sending the URL to a helper", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("CORS"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderScreen();
    expect(document.querySelector(".dialogue-box")).toBeNull();
    await user.click(screen.getByRole("button", { name: "アグリと話す" }));
    expect(await screen.findByRole("heading", { name: "この記事は直接開けませんでした" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.some(
        (call) => typeof call[0] === "string" && call[0].startsWith("https://r.jina.ai/")
      )
    ).toBe(false);
    expect(serviceMocks.startNewsConversation).not.toHaveBeenCalled();
  });

  it("uses the helper once without persisting consent, then starts the room conversation", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("CORS"))
      .mockResolvedValueOnce(
        new Response(`Title: 記事\nMarkdown Content:\n${helperText}`, {
          status: 200,
          headers: { "content-type": "text/plain" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { props } = renderScreen();
    await user.click(screen.getByRole("button", { name: "アグリと話す" }));
    await user.click(await screen.findByRole("button", { name: "今回だけ許可" }));
    await waitFor(() => expect(serviceMocks.startNewsConversation).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`https://r.jina.ai/${item.url}`);
    expect((await db.settings.get("local"))?.newsUseArticleHelper).toBe(false);
    expect(props.onConversationStarted).toHaveBeenCalledTimes(1);
  });

  it("persists consent only when the player selects future permission", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("CORS"))
      .mockResolvedValueOnce(
        new Response(`Title: 記事\nMarkdown Content:\n${helperText}`, {
          status: 200,
          headers: { "content-type": "text/plain" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole("button", { name: "アグリと話す" }));
    await user.click(await screen.findByRole("button", { name: "今後も許可" }));
    await waitFor(() => expect(serviceMocks.startNewsConversation).toHaveBeenCalledTimes(1));
    expect((await db.settings.get("local"))?.newsUseArticleHelper).toBe(true);
  });

  it("can start a normal session from the fallback without helper access", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("CORS")));
    const user = userEvent.setup();
    const { props } = renderScreen();
    await user.click(screen.getByRole("button", { name: "アグリと話す" }));
    await user.click(await screen.findByRole("button", { name: /許可しない/ }));
    await waitFor(() => expect(serviceMocks.startNewsConversation).toHaveBeenCalledTimes(1));
    const startInput = serviceMocks.startNewsConversation.mock.calls[0]?.[0] as
      { digest: { contentLevel: string } } | undefined;
    expect(startInput?.digest.contentLevel).toBe("feed_summary");
    expect(props.onConversationStarted).toHaveBeenCalledTimes(1);
  });

  it("keeps helper consent visible after remount", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("CORS")));
    const user = userEvent.setup();
    const first = renderScreen();
    await user.click(screen.getByRole("button", { name: "アグリと話す" }));
    await screen.findByRole("heading", { name: "この記事は直接開けませんでした" });
    first.unmount();
    renderScreen();
    expect(await screen.findByRole("button", { name: "今回だけ許可" })).toBeTruthy();
    expect(serviceMocks.startNewsConversation).not.toHaveBeenCalled();
  });

  it("keeps the shelf open and restores the article state when another conversation is active", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("CORS")));
    serviceMocks.startNewsConversation.mockRejectedValue(
      new Error("今の会話を終えてから、ニュースを選んでください。")
    );
    const user = userEvent.setup();
    const { props } = renderScreen();
    await user.click(screen.getByRole("button", { name: "アグリと話す" }));
    await user.click(await screen.findByRole("button", { name: /許可しない/ }));

    expect(await screen.findByText("今の会話を終えてから、ニュースを選んでください。")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "ニュース" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "記事の準備ができました" })).toBeNull();
    expect((await db.newsItems.get(item.id))?.discussionState).toBe("unread");
    expect(props.onConversationStarted).not.toHaveBeenCalled();
  });
});
