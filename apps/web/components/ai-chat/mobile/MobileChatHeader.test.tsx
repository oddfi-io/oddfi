/**
 * @vitest-environment jsdom
 *
 * DD-125 验收 — MobileChatHeader（H5 pill tabs + tab 相关动作键 + 汉堡占位）。
 * chat tab → 清理按钮；news tab → 音量开关（NewsSoundToggle，桩掉避开 store）。
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileChatHeader } from "./MobileChatHeader";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));
vi.mock("../NewsSoundToggle", () => ({
  NewsSoundToggle: () => <div data-testid="sound-toggle" />,
}));

function setup(overrides: Partial<Parameters<typeof MobileChatHeader>[0]> = {}) {
  const onSelect = vi.fn();
  const onClear = vi.fn();
  const onMenu = vi.fn();
  render(
    <MobileChatHeader
      activeTab="chat"
      onSelect={onSelect}
      unreadCount={3}
      onClear={onClear}
      onMenu={onMenu}
      {...overrides}
    />
  );
  return { onSelect, onClear, onMenu };
}

describe("MobileChatHeader", () => {
  it("渲染对话/新闻 pill tab + 未读计数", () => {
    setup();
    expect(screen.getByText("tabs.chat")).toBeTruthy();
    expect(screen.getByText("tabs.news")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("点击新闻 tab → onSelect('news')", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByText("tabs.news"));
    expect(onSelect).toHaveBeenCalledWith("news");
  });

  it("chat tab → 显示清理按钮，点击触发 onClear（无音量开关）", () => {
    const { onClear } = setup({ activeTab: "chat" });
    fireEvent.click(screen.getByLabelText("Clear chat history"));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("sound-toggle")).toBeNull();
  });

  it("news tab → 显示音量开关，不显示清理按钮", () => {
    setup({ activeTab: "news" });
    expect(screen.getByTestId("sound-toggle")).toBeTruthy();
    expect(screen.queryByLabelText("Clear chat history")).toBeNull();
  });

  it("汉堡菜单按钮存在（视觉占位，挂 onMenu）", () => {
    const { onMenu } = setup();
    const menu = screen.getByLabelText("Menu");
    fireEvent.click(menu);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it("unreadCount=0 → 不显示计数；>99 → 99+", () => {
    const { rerender } = render(
      <MobileChatHeader activeTab="chat" onSelect={vi.fn()} unreadCount={0} onClear={vi.fn()} />
    );
    expect(screen.queryByText("0")).toBeNull();
    rerender(
      <MobileChatHeader activeTab="chat" onSelect={vi.fn()} unreadCount={150} onClear={vi.fn()} />
    );
    expect(screen.getByText("99+")).toBeTruthy();
  });
});
