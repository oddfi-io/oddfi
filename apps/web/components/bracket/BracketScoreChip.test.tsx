// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

import BracketScoreChip from "./BracketScoreChip";

describe("BracketScoreChip", () => {
  it("lg size 占位态显示单个 ???（足球图标 + ???）", () => {
    render(<BracketScoreChip size="lg" />);
    const placeholders = screen.getAllByText("???");
    expect(placeholders).toHaveLength(1);
  });

  it("md size 占位态显示单个 ???", () => {
    render(<BracketScoreChip size="md" />);
    const placeholders = screen.getAllByText("???");
    expect(placeholders).toHaveLength(1);
  });

  it("有比分时显示 'X - Y' 格式", () => {
    render(<BracketScoreChip size="lg" homeScore={2} awayScore={1} />);
    expect(screen.getByText("2 - 1")).toBeDefined();
  });

  it("homeScore=0 / awayScore=0 时显示 '0 - 0'", () => {
    render(<BracketScoreChip size="md" homeScore={0} awayScore={0} />);
    expect(screen.getByText("0 - 0")).toBeDefined();
  });

  it("lg variant 容器宽度类包含 w-[152px]", () => {
    const { container } = render(<BracketScoreChip size="lg" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("w-[152px]");
  });

  it("md variant 容器宽度类包含 w-[116px]", () => {
    const { container } = render(<BracketScoreChip size="md" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("w-[116px]");
  });
});
