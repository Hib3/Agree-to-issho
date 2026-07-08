// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "../screens/SettingsScreen";
import type { GameSettings } from "../types/domain";

const settings: GameSettings = {
  id: "local",
  reduce_motion: false,
  text_speed: "normal",
  autosave: true,
  auto_talk: true,
  debug_panel: false,
  updated_at: "2026-07-08T00:00:00.000Z"
};

describe("SettingsScreen", () => {
  afterEach(() => cleanup());

  it("can toggle spontaneous Aguri talk", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SettingsScreen settings={settings} onChange={onChange} onBack={vi.fn()} />);

    await user.click(screen.getByLabelText("アグリちゃんが自分から話す"));
    expect(onChange).toHaveBeenCalledWith({ auto_talk: false });
  });
});
