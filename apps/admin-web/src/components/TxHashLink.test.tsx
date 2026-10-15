// TxHashLink：截断/全量展示 + bscscan 链接 + 空值占位。
// truncate 默认 true（省列宽）；EOA 全量展示场景传 false（REQ-002 B）。
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TxHashLink } from "./TxHashLink";

const ADDR = "0x5519aBcD1234567890123456789012345678" + "06a4"; // 42 位

describe("TxHashLink", () => {
  it("默认截断展示（0x1a2b…ef）", () => {
    render(<TxHashLink value={ADDR} kind="address" />);
    const link = screen.getByRole("link");
    expect(link.textContent).toBe("0x5519…06a4");
    expect(link.textContent).not.toBe(ADDR);
  });

  it("truncate={false} 展示完整地址", () => {
    render(<TxHashLink value={ADDR} kind="address" truncate={false} />);
    expect(screen.getByRole("link").textContent).toBe(ADDR);
  });

  it("address 指向 bscscan /address/，tx 指向 /tx/", () => {
    const { rerender } = render(<TxHashLink value={ADDR} kind="address" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `https://bscscan.com/address/${ADDR}`,
    );
    rerender(<TxHashLink value="0xdeadbeef" kind="tx" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://bscscan.com/tx/0xdeadbeef");
  });

  it("空值渲染占位符，不渲染链接", () => {
    render(<TxHashLink value={null} kind="address" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
