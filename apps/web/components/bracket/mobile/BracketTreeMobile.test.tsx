// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock next/image (avoid jsdom Image loader issues)
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={typeof src === "string" ? src : ""} />
  ),
}));

import BracketTreeMobile from "./BracketTreeMobile";

describe("BracketTreeMobile", () => {
  it("渲染 WORLD CHAMPIONS 标题", () => {
    render(<BracketTreeMobile />);
    expect(screen.getByText(/world champions/i)).toBeDefined();
  });

  it("R32 全部使用国旗占位（不渲染 TBD 文字）", () => {
    render(<BracketTreeMobile />);
    expect(screen.queryAllByText(/TBD/).length).toBe(0);
  });

  it("决赛区域渲染足球占位（无 trophy）", () => {
    render(<BracketTreeMobile />);
    expect(screen.queryByAltText(/trophy/i)).toBeNull();
    // 足球占位至少 home + away 两张
    const balls = screen.getAllByAltText(/home|away/);
    expect(balls.length).toBeGreaterThanOrEqual(2);
  });

  it("VS 文本贯穿各 round（R32 8 行 × 4 + R16 2 × 4 + QF 2×2 + SF 2 + Final 1 = 至少 13）", () => {
    render(<BracketTreeMobile />);
    const vsCount = screen.getAllByText("VS").length;
    expect(vsCount).toBeGreaterThanOrEqual(13);
  });
});
