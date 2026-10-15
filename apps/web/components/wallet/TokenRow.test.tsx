// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { TokenRow } from "./TokenRow";
import type { PortfolioToken } from "@/hooks/useMultiChainPortfolio";
import { BSC_TOKENS, CHAIN_ICON_MAP } from "@/lib/token-registry";

afterEach(cleanup);

const makeToken = (overrides: Partial<PortfolioToken> = {}): PortfolioToken => ({
  meta: BSC_TOKENS.find((t) => t.symbol === "USDT")!,
  chainId: 56,
  chainIcon: CHAIN_ICON_MAP[56],
  balance: "1234.5678",
  usdValue: "1234.5678",
  hasPriceData: true,
  ...overrides,
});

describe("TokenRow", () => {
  it("renders symbol", () => {
    render(<TokenRow token={makeToken()} />);
    expect(screen.getByText("USDT")).toBeTruthy();
  });

  it("formats balance with 2 decimals", () => {
    render(<TokenRow token={makeToken({ balance: "100.1234" })} />);
    expect(screen.getByText("100.12")).toBeTruthy();
  });

  it("shows $-prefixed USD for small amounts", () => {
    render(<TokenRow token={makeToken({ balance: "5.00", usdValue: "5.00" })} />);
    expect(screen.getByText("$5.00")).toBeTruthy();
  });

  it("uses formatCompact for large USD values", () => {
    render(<TokenRow token={makeToken({ balance: "5000.00", usdValue: "5000.00" })} />);
    expect(screen.getByText("$5K")).toBeTruthy();
  });

  it("falls back to first letter circle on img error", () => {
    render(<TokenRow token={makeToken()} />);
    const img = screen.getByAltText("USDT") as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.queryByAltText("USDT")).toBeNull();
    expect(screen.getByText("U")).toBeTruthy();
  });

  it("row has min-h-[56px] touch target", () => {
    const { container } = render(<TokenRow token={makeToken()} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain("min-h-[56px]");
  });

  it("renders chain badge icon", () => {
    const { container } = render(<TokenRow token={makeToken()} />);
    const chainBadge = container.querySelector("img[width='16']");
    expect(chainBadge).toBeTruthy();
  });

  it("calls onSelect with symbol when clicked", () => {
    const onSelect = vi.fn();
    render(<TokenRow token={makeToken()} onSelect={onSelect} />);
    const row = screen.getByRole("option");
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith("USDT");
  });

  it("shows cursor-pointer when onSelect is provided", () => {
    const { container } = render(<TokenRow token={makeToken()} onSelect={vi.fn()} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain("cursor-pointer");
  });

  it("applies active styles when isActive is true", () => {
    const { container } = render(<TokenRow token={makeToken()} isActive onSelect={vi.fn()} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain("bg-white/[0.07]");
  });

  it("does not apply active styles when isActive is false", () => {
    const { container } = render(
      <TokenRow token={makeToken()} isActive={false} onSelect={vi.fn()} />
    );
    const row = container.firstChild as HTMLElement;
    expect(row.className).not.toContain("bg-white/[0.07]");
  });
});
