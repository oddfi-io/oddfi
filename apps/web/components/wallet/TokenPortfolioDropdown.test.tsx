// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TokenPortfolioDropdown } from "./TokenPortfolioDropdown";
import type { PortfolioToken } from "@/hooks/useMultiChainPortfolio";
import { BSC_TOKENS, CHAIN_ICON_MAP } from "@/lib/token-registry";

afterEach(cleanup);

const mockPortfolio: PortfolioToken[] = BSC_TOKENS.map((meta) => ({
  meta,
  chainId: 56,
  chainIcon: CHAIN_ICON_MAP[56],
  balance: "100.0000",
  usdValue: "100.00",
  hasPriceData: true,
}));

describe("TokenPortfolioDropdown", () => {
  it("renders all tokens when search is empty", () => {
    render(<TokenPortfolioDropdown portfolio={mockPortfolio} isLoading={false} />);
    expect(screen.getAllByText("BNB").length).toBeGreaterThan(0);
    expect(screen.getByText("USDT")).toBeTruthy();
    expect(screen.getByText("USDC")).toBeTruthy();
    expect(screen.getByText("ODD")).toBeTruthy();
  });

  it("filters by symbol (case-insensitive)", () => {
    render(<TokenPortfolioDropdown portfolio={mockPortfolio} isLoading={false} />);
    const input = screen.getByPlaceholderText("Search tokens...");
    fireEvent.change(input, { target: { value: "us" } });

    expect(screen.getByText("USDT")).toBeTruthy();
    expect(screen.getByText("USDC")).toBeTruthy();
    expect(screen.queryByText("BNB")).toBeNull();
    expect(screen.queryByText("ODD")).toBeNull();
  });

  it("filters by name (case-insensitive)", () => {
    render(<TokenPortfolioDropdown portfolio={mockPortfolio} isLoading={false} />);
    const input = screen.getByPlaceholderText("Search tokens...");
    fireEvent.change(input, { target: { value: "odd" } });

    expect(screen.getByText("ODD")).toBeTruthy();
    expect(screen.queryByText("USDT")).toBeNull();
  });

  it("shows empty state when no tokens match search", () => {
    render(<TokenPortfolioDropdown portfolio={mockPortfolio} isLoading={false} />);
    const input = screen.getByPlaceholderText("Search tokens...");
    fireEvent.change(input, { target: { value: "xyz123" } });

    expect(screen.getByText("No tokens found")).toBeTruthy();
  });

  it("shows skeleton rows when loading", () => {
    const { container } = render(<TokenPortfolioDropdown portfolio={[]} isLoading={true} />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText("No tokens found")).toBeNull();
  });

  it("clears search to show all tokens again", () => {
    render(<TokenPortfolioDropdown portfolio={mockPortfolio} isLoading={false} />);
    const input = screen.getByPlaceholderText("Search tokens...");
    fireEvent.change(input, { target: { value: "bnb" } });
    expect(screen.queryByText("USDT")).toBeNull();

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("USDT")).toBeTruthy();
    expect(screen.getAllByText("BNB").length).toBeGreaterThan(0);
  });

  it("search input has min-h-[44px] touch target", () => {
    const { container } = render(
      <TokenPortfolioDropdown portfolio={mockPortfolio} isLoading={false} />
    );
    const searchWrapper = container.querySelector('[class*="min-h-\\[44px\\]"]');
    expect(searchWrapper).toBeTruthy();
  });

  it("renders section labels", () => {
    render(<TokenPortfolioDropdown portfolio={mockPortfolio} isLoading={false} />);
    expect(screen.getByText("Network")).toBeTruthy();
    expect(screen.getByText("Tokens")).toBeTruthy();
  });

  it("renders Add Funds button", () => {
    render(<TokenPortfolioDropdown portfolio={mockPortfolio} isLoading={false} />);
    expect(screen.getByText("Add Funds")).toBeTruthy();
  });

  it("calls onAddFunds when Add Funds button is clicked", () => {
    const onAddFunds = vi.fn();
    render(
      <TokenPortfolioDropdown portfolio={mockPortfolio} isLoading={false} onAddFunds={onAddFunds} />
    );
    fireEvent.click(screen.getByText("Add Funds"));
    expect(onAddFunds).toHaveBeenCalledTimes(1);
  });

  it("highlights active token row", () => {
    const { container } = render(
      <TokenPortfolioDropdown
        portfolio={mockPortfolio}
        isLoading={false}
        activeSymbol="USDT"
        onSelectToken={vi.fn()}
      />
    );
    const activeRow = container.querySelector('[aria-selected="true"]');
    expect(activeRow).toBeTruthy();
    expect(activeRow?.className).toContain("bg-white/[0.07]");
  });

  it("calls onSelectToken when a token row is clicked", () => {
    const onSelectToken = vi.fn();
    render(
      <TokenPortfolioDropdown
        portfolio={mockPortfolio}
        isLoading={false}
        activeSymbol="USDT"
        onSelectToken={onSelectToken}
      />
    );
    const oddRow = screen.getByText("ODD").closest("[role='option']")!;
    fireEvent.click(oddRow);
    expect(onSelectToken).toHaveBeenCalledWith("ODD");
  });
});
