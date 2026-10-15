// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Toggle from "./Toggle";

describe("Toggle", () => {
  it("checked 反映在 aria-checked 上", () => {
    render(<Toggle checked={true} onChange={vi.fn()} ariaLabel="t" />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("点击触发 onChange(!checked)", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="t" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("disabled 拦截点击", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="t" disabled />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("active 态 thumb 在右、container bg-fn-brand", () => {
    render(<Toggle checked={true} onChange={vi.fn()} ariaLabel="t" />);
    const btn = screen.getByRole("switch");
    expect(btn.className).toContain("bg-fn-brand");
    const thumb = btn.querySelector("span");
    expect(thumb?.className).toContain("left-[21px]");
  });
});
