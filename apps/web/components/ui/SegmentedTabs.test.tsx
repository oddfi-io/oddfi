// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SegmentedTabs from "./SegmentedTabs";

const tabs = [
  { key: "a", label: "Alpha" },
  { key: "b", label: "Beta" },
] as const;

describe("SegmentedTabs", () => {
  it("渲染所有 tab label", () => {
    render(<SegmentedTabs tabs={[...tabs]} value="a" onChange={vi.fn()} />);
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
  });

  it("当前 value 对应按钮 aria-selected=true 且带激活态色", () => {
    render(<SegmentedTabs tabs={[...tabs]} value="a" onChange={vi.fn()} />);
    const alphaBtn = screen.getByText("Alpha");
    expect(alphaBtn.getAttribute("aria-selected")).toBe("true");
    expect(alphaBtn.className).toContain("bg-btn-primary-white");
  });

  it("点击非激活 tab 触发 onChange", () => {
    const onChange = vi.fn();
    render(<SegmentedTabs tabs={[...tabs]} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("containerClassName / itemClassName 正确合并到 DOM", () => {
    const { container } = render(
      <SegmentedTabs
        tabs={[...tabs]}
        value="a"
        onChange={vi.fn()}
        containerClassName="lg:w-fit"
        itemClassName="lg:w-[120px]"
      />
    );
    expect(container.querySelector('[role="tablist"]')?.className).toContain("lg:w-fit");
    expect(screen.getByText("Alpha").className).toContain("lg:w-[120px]");
  });
});
