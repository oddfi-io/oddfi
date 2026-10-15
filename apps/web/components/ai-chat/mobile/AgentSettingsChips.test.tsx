/**
 * @vitest-environment jsdom
 *
 * DD-135 Batch 4 — AgentSettingsChips 组件测试。
 * 覆盖：5 chips 渲染（含疑点 1：第 5 chip = usage）、点击回调、选中态 aria、选中项滚入视口。
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { AgentSettingsChips } from "./AgentSettingsChips";

beforeEach(() => {
  // jsdom 无 scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

describe("AgentSettingsChips", () => {
  it("渲染 5 个 chips，第 5 个为 usage（设计稿笔误已纠正）", () => {
    render(<AgentSettingsChips activeTab="basics" onSelect={() => {}} />);
    ["basics", "behavior", "notification", "memory", "usage"].forEach((label) => {
      expect(screen.getByText(label)).toBeTruthy();
    });
  });

  it("点击 chip → onSelect 收到对应 ConfigTab（notification → notify）", () => {
    const onSelect = vi.fn();
    render(<AgentSettingsChips activeTab="basics" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("notification"));
    expect(onSelect).toHaveBeenCalledWith("notify");
    fireEvent.click(screen.getByText("usage"));
    expect(onSelect).toHaveBeenCalledWith("usage");
  });

  it("选中态：activeTab 对应 chip 带 aria-current=page，其余无", () => {
    render(<AgentSettingsChips activeTab="memory" onSelect={() => {}} />);
    const active = screen.getByText("memory").closest("button");
    const inactive = screen.getByText("basics").closest("button");
    expect(active?.getAttribute("aria-current")).toBe("page");
    expect(inactive?.getAttribute("aria-current")).toBeNull();
  });

  it("activeTab 变化 → 选中项 scrollIntoView（横向滚动定位）", () => {
    const { rerender } = render(<AgentSettingsChips activeTab="basics" onSelect={() => {}} />);
    rerender(<AgentSettingsChips activeTab="usage" onSelect={() => {}} />);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
