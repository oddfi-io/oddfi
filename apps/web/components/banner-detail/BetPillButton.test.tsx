// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import BetPillButton from "./BetPillButton";

describe("BetPillButton", () => {
  afterEach(cleanup);

  it("renders Bet text and triggers onClick", () => {
    const onClick = vi.fn();
    render(<BetPillButton onClick={onClick} />);
    const btn = screen.getByRole("button", { name: "Place bet" });
    expect(btn).toHaveTextContent("Bet");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("uses CSS variable for brand-default bg (not bg-brand-default class)", () => {
    render(<BetPillButton onClick={() => {}} />);
    const btn = screen.getByRole("button");
    // 验证 inline style 走 CSS 变量 — Tailwind 没注册 bg-brand-default 类
    expect(btn.style.backgroundColor).toBe("var(--text-brand-default)");
    expect(btn.className).not.toMatch(/\bbg-brand-default\b/);
  });

  it("respects custom ariaLabel for screen-reader context", () => {
    render(<BetPillButton onClick={() => {}} ariaLabel="Bet on Spain" />);
    expect(screen.getByRole("button", { name: "Bet on Spain" })).toBeInTheDocument();
  });
});
