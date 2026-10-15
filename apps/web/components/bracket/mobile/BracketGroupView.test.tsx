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

import BracketGroupView from "./BracketGroupView";

describe("BracketGroupView", () => {
  it("渲染 12 个 Group 标签（A-L）", () => {
    render(<BracketGroupView />);
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    groups.forEach((key) => {
      expect(screen.getByText(`Group ${key}`)).toBeDefined();
    });
  });

  it("每组渲染 4 支队名", () => {
    render(<BracketGroupView />);
    // Group A: Mexico, South Korea, Czech Republic, South Africa
    expect(screen.getByText("Mexico")).toBeDefined();
    expect(screen.getByText("South Korea")).toBeDefined();
    expect(screen.getByText("Czech Republic")).toBeDefined();
    expect(screen.getByText("South Africa")).toBeDefined();
  });

  it("渲染 12×4=48 个国旗图片", () => {
    render(<BracketGroupView />);
    const flags = screen.getAllByRole("img");
    expect(flags).toHaveLength(48);
  });
});
