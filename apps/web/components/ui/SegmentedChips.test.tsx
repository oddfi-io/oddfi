// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SegmentedChips from "./SegmentedChips";

const items = [
  { key: "a", label: "Alpha" },
  { key: "b", label: "Beta" },
  { key: "c", label: "Gamma" },
] as const;

describe("SegmentedChips", () => {
  it("渲染所有 item label 且 active item aria-checked=true", () => {
    render(<SegmentedChips items={[...items]} value="b" onChange={vi.fn()} />);
    expect(screen.getByText("Alpha")).toBeDefined();
    const beta = screen.getByText("Beta");
    expect(beta.getAttribute("aria-checked")).toBe("true");
    expect(beta.className).toContain("bg-fn-brand");
  });

  it("点击非激活 item 触发 onChange(key)", () => {
    const onChange = vi.fn();
    render(<SegmentedChips items={[...items]} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByText("Gamma"));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("itemWidth 覆盖默认 53px", () => {
    render(<SegmentedChips items={[...items]} value="a" onChange={vi.fn()} itemWidth={80} />);
    const alpha = screen.getByText("Alpha");
    expect(alpha.getAttribute("style")).toContain("width: 80px");
  });

  it("containerClassName 正确合并", () => {
    const { container } = render(
      <SegmentedChips
        items={[...items]}
        value="a"
        onChange={vi.fn()}
        containerClassName="md:w-full"
      />
    );
    const root = container.querySelector('[role="radiogroup"]');
    expect(root?.className).toContain("md:w-full");
  });
});
