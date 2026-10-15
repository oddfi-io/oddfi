// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BracketGroupSideColumn from "./BracketGroupSideColumn";

// next/image mock
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

describe("BracketGroupSideColumn", () => {
  it("left side 渲染 Group A-F 共 6 张卡", () => {
    render(<BracketGroupSideColumn side="left" />);
    expect(screen.getByText(/Group A/i)).toBeDefined();
    expect(screen.getByText(/Group F/i)).toBeDefined();
    // 不应显示 G-L
    expect(screen.queryByText(/Group G/i)).toBeNull();
  });

  it("right side 渲染 Group G-L 共 6 张卡", () => {
    render(<BracketGroupSideColumn side="right" />);
    expect(screen.getByText(/Group G/i)).toBeDefined();
    expect(screen.getByText(/Group L/i)).toBeDefined();
    // 不应显示 A-F
    expect(screen.queryByText(/Group A/i)).toBeNull();
  });

  it("每张卡渲染 4 个国旗", () => {
    render(<BracketGroupSideColumn side="left" />);
    const flags = screen.getAllByRole("img");
    // 6 组 × 4 国旗 = 24
    expect(flags).toHaveLength(24);
  });

  it("onMouseEnter 触发时传递正确 groupKey", () => {
    const onMouseEnter = vi.fn();
    const { container } = render(
      <BracketGroupSideColumn side="left" onMouseEnter={onMouseEnter} />
    );
    const firstCard = container.querySelector('[data-group="A"]') as HTMLElement;
    expect(firstCard).toBeDefined();
    fireEvent.mouseEnter(firstCard);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onMouseEnter.mock.calls[0][1]).toBe("A");
  });

  it("onMouseLeave 触发时调用回调", () => {
    const onMouseLeave = vi.fn();
    const { container } = render(
      <BracketGroupSideColumn side="left" onMouseLeave={onMouseLeave} />
    );
    const firstCard = container.querySelector('[data-group="A"]') as HTMLElement;
    fireEvent.mouseLeave(firstCard);
    expect(onMouseLeave).toHaveBeenCalledTimes(1);
  });

  it("容器包含 xl:flex 响应式类", () => {
    const { container } = render(<BracketGroupSideColumn side="left" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("xl:flex");
  });
});
