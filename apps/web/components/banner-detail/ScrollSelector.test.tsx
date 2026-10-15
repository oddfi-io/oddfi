// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ScrollSelector from "./ScrollSelector";

const VALUES = [
  { label: "0" },
  { label: "1" },
  { label: "2" },
  { label: "3" },
  { label: "4" },
  { label: "5" },
  { label: "6" },
  { label: "7" },
  { label: "8" },
  { label: "8+" },
];

describe("ScrollSelector", () => {
  afterEach(cleanup);

  it("renders all labels", () => {
    render(<ScrollSelector values={VALUES} selectedIndex={7} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("8+")).toBeInTheDocument();
  });

  it("marks current dot with aria-current", () => {
    const { container } = render(<ScrollSelector values={VALUES} selectedIndex={3} />);
    const current = container.querySelectorAll('[aria-current="true"]');
    expect(current).toHaveLength(1);
  });

  it("calls onChange when a label is clicked", () => {
    const onChange = vi.fn();
    render(<ScrollSelector values={VALUES} selectedIndex={0} onChange={onChange} />);
    fireEvent.click(screen.getByText("3"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("preserves Figma node id for traceability", () => {
    const { container } = render(<ScrollSelector values={VALUES} selectedIndex={0} />);
    expect(container.querySelector('[data-figma-node="3638:12292"]')).toBeInTheDocument();
    expect(container.querySelector('[data-figma-node="3604:12679"]')).toBeInTheDocument();
  });

  it("exposes role=slider with aria value range", () => {
    const { container } = render(<ScrollSelector values={VALUES} selectedIndex={4} />);
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    expect(slider).toBeInTheDocument();
    expect(slider.getAttribute("aria-valuemin")).toBe("0");
    expect(slider.getAttribute("aria-valuemax")).toBe("9");
    expect(slider.getAttribute("aria-valuenow")).toBe("4");
    expect(slider.getAttribute("aria-valuetext")).toBe("4");
  });

  it("dispatches onChange when track is pointer-dragged", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ScrollSelector values={VALUES} selectedIndex={0} onChange={onChange} />
    );
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    // jsdom 不实现 layout — 用 stub 给定 200px 宽度（10 档，每档 ~22px）
    slider.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 12, width: 200, height: 12 }) as DOMRect;
    // 模拟按下并拖到约 66.7% 处 → 索引 6
    slider.setPointerCapture = () => {};
    slider.releasePointerCapture = () => {};
    fireEvent.pointerDown(slider, { button: 0, pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 133 });
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 133 });
    // pointerDown(0) 也会触发 onChange(0) 但 safeIdx 已是 0 → 跳过；只有 move 到 idx=6 触发
    expect(onChange).toHaveBeenLastCalledWith(6);
  });
});
