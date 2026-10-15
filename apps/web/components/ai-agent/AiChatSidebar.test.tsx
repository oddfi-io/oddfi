/**
 * @vitest-environment jsdom
 *
 * DD-121 Batch 5 — AiChatSidebar 组件测试。
 * 覆盖：Feature 7 项渲染 + 点击回调路由（New Chat / Search / config tab）、
 * Recents 列表渲染 + 清理按钮（空列表隐藏）。
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// useTranslations → 直接回传 key，断言用 key 文案
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { AiChatSidebar, type RecentEntry } from "./AiChatSidebar";

function setup(recents: RecentEntry[] = []) {
  const onNewChat = vi.fn();
  const onSearch = vi.fn();
  const onClearRecents = vi.fn();
  const onOpenConfig = vi.fn();
  render(
    <AiChatSidebar
      recents={recents}
      onNewChat={onNewChat}
      onSearch={onSearch}
      onClearRecents={onClearRecents}
      onOpenConfig={onOpenConfig}
    />
  );
  return { onNewChat, onSearch, onClearRecents, onOpenConfig };
}

describe("AiChatSidebar", () => {
  it("渲染 Feature 7 项", () => {
    setup();
    ["newChat", "search", "basics", "behavior", "notification", "memory", "usage"].forEach(
      (label) => {
        expect(screen.getByText(label)).toBeTruthy();
      }
    );
  });

  it("New Chat 触发 onNewChat", () => {
    const { onNewChat } = setup();
    fireEvent.click(screen.getByText("newChat"));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("5 个配置项各自打开对应 config tab", () => {
    const { onOpenConfig } = setup();
    const cases: Array<[string, string]> = [
      ["basics", "basics"],
      ["behavior", "behavior"],
      ["notification", "notify"],
      ["memory", "memory"],
      ["usage", "usage"],
    ];
    for (const [label, tab] of cases) {
      fireEvent.click(screen.getByText(label));
      expect(onOpenConfig).toHaveBeenCalledWith(tab);
    }
  });

  it("Search 点击触发 onSearch（占位）", () => {
    const { onSearch } = setup();
    fireEvent.click(screen.getByText("search"));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("空 Recents 不渲染清理按钮", () => {
    setup([]);
    expect(screen.queryByLabelText("Clear all chat history")).toBeNull();
  });

  it("有 Recents 时渲染条目与清理按钮，点击触发 onClearRecents", () => {
    const { onClearRecents } = setup([{ id: "r1", title: "Argentina vs Spain", timeLabel: "5m" }]);
    expect(screen.getByText("Argentina vs Spain")).toBeTruthy();
    expect(screen.getByText("5m")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Clear all chat history"));
    expect(onClearRecents).toHaveBeenCalledTimes(1);
  });
});
