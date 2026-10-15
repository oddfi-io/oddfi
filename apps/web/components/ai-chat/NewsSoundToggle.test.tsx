/**
 * @vitest-environment jsdom
 *
 * DD-125 — NewsSoundToggle（PC/H5 通用新闻通知音开关）。
 * 唯一权威 aiAgentStore.config.sound.enabled，点击 patchConfig 取反。
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NewsSoundToggle } from "./NewsSoundToggle";

let mockSound = { id: "ding" as string | null, enabled: true };
const patchConfig = vi.fn();

vi.mock("@/stores/aiAgentStore", () => ({
  useAiAgentStore: (
    sel: (s: { config: { sound: typeof mockSound }; patchConfig: typeof patchConfig }) => unknown
  ) => sel({ config: { sound: mockSound }, patchConfig }),
}));

beforeEach(() => {
  mockSound = { id: "ding", enabled: true };
  patchConfig.mockClear();
});
afterEach(() => vi.clearAllMocks());

describe("NewsSoundToggle", () => {
  it("enabled → aria 提示 Mute + aria-pressed true", () => {
    render(<NewsSoundToggle />);
    const btn = screen.getByLabelText("Mute news notifications");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("enabled 点击 → patchConfig 关闭声音", () => {
    render(<NewsSoundToggle />);
    fireEvent.click(screen.getByLabelText("Mute news notifications"));
    expect(patchConfig).toHaveBeenCalledWith({ sound: { id: "ding", enabled: false } });
  });

  it("muted → aria 提示 Unmute + 点击重新开启", () => {
    mockSound = { id: "ding", enabled: false };
    render(<NewsSoundToggle />);
    const btn = screen.getByLabelText("Unmute news notifications");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(patchConfig).toHaveBeenCalledWith({ sound: { id: "ding", enabled: true } });
  });
});
