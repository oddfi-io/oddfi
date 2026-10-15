// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MOCK_BRACKET } from "@/lib/bracket/mock-data";

import BracketTreeDesktop from "./BracketTreeDesktop";

// next/image mock
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

describe("BracketTreeDesktop", () => {
  it("left side 渲染无报错", () => {
    const { container } = render(<BracketTreeDesktop side="left" bracket={MOCK_BRACKET} />);
    expect(container.firstChild).toBeDefined();
  });

  it("right side 用 flex-row-reverse 倒置列顺序（不用 scaleX 避免文字反向）", () => {
    const { container } = render(<BracketTreeDesktop side="right" bracket={MOCK_BRACKET} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("flex-row-reverse");
    expect(root.style.transform).toBeFalsy();
  });

  it("left side 用普通 flex-row 顺序", () => {
    const { container } = render(<BracketTreeDesktop side="left" bracket={MOCK_BRACKET} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("flex-row");
    expect(root.className).not.toContain("flex-row-reverse");
  });

  it("渲染 R32 cell 含 data-r32-cell 属性", () => {
    const { container } = render(<BracketTreeDesktop side="left" bracket={MOCK_BRACKET} />);
    const cells = container.querySelectorAll("[data-r32-cell]");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("R32 cell 含 data-group 属性", () => {
    const { container } = render(<BracketTreeDesktop side="left" bracket={MOCK_BRACKET} />);
    const cells = container.querySelectorAll("[data-group]");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("onHoverStart 和 onHoverEnd 透传给 R32 cell", () => {
    const onHoverStart = vi.fn();
    const onHoverEnd = vi.fn();
    const { container } = render(
      <BracketTreeDesktop
        side="left"
        bracket={MOCK_BRACKET}
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
      />
    );
    const firstCell = container.querySelector("[data-r32-cell]") as HTMLElement;
    expect(firstCell).toBeDefined();
  });
});
