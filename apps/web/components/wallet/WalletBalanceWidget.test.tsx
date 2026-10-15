// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { WalletBalanceWidget } from "./WalletBalanceWidget";
import { useWalletDisplayStore } from "@/stores/walletDisplayStore";

vi.mock("@/hooks/useMultiChainPortfolio", () => ({
  useMultiChainPortfolio: vi.fn(() => ({ portfolio: [], isLoading: false })),
}));
vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ chain: { id: 56 }, address: "0x1234" })),
  useBalance: vi.fn(() => ({ data: undefined, isLoading: false })),
}));
vi.mock("@/hooks/useTokenBalance", () => ({
  useTokenBalance: vi.fn(() => ({
    formatted: "0",
    refetch: vi.fn(),
  })),
}));

import { useTokenBalance } from "@/hooks/useTokenBalance";

function setupTokenBalance(formatted: string) {
  vi.mocked(useTokenBalance).mockReturnValue({
    balance: BigInt(0),
    formatted,
    decimals: 18,
    isLoading: false,
    refetch: vi.fn(),
  } as ReturnType<typeof useTokenBalance>);
}

describe("WalletBalanceWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWalletDisplayStore.setState({ activeSymbol: null, balanceVersion: 0 });
    setupTokenBalance("0");
    // Mock matchMedia for hover detection
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });
  afterEach(cleanup);

  it("shows 0.00 when balance is zero", () => {
    setupTokenBalance("0");
    render(<WalletBalanceWidget />);
    expect(screen.getByText("0.00")).toBeTruthy();
  });

  it("shows formatted balance when positive", () => {
    setupTokenBalance("1234.5678");
    render(<WalletBalanceWidget />);
    // decimal.js uses ROUND_DOWN, so 1234.5678 → 1234.56
    expect(screen.getByText("1234.56")).toBeTruthy();
  });

  it("renders platform token icon", () => {
    render(<WalletBalanceWidget />);
    // PLATFORM_TOKEN is ODD — img with alt=ODD
    expect(screen.getByAltText("ODD")).toBeTruthy();
  });

  it("renders chain badge", () => {
    render(<WalletBalanceWidget />);
    expect(screen.getByAltText("chain")).toBeTruthy();
  });

  it("trigger has h-10 height and is keyboard-focusable", () => {
    const { container } = render(<WalletBalanceWidget />);
    const trigger = container.querySelector("[role='button']") as HTMLElement;
    expect(trigger.className).toContain("h-10");
    expect(trigger.tabIndex).toBe(0);
  });

  it("dropdown is not rendered (DROPDOWN_ENABLED = false)", () => {
    render(<WalletBalanceWidget />);
    expect(screen.queryByPlaceholderText("Search tokens...")).toBeNull();
    // CaretDown (expand label) should also be absent
    expect(screen.queryByLabelText("expand")).toBeNull();
  });

  it("trigger click does not open dropdown (DROPDOWN_ENABLED = false)", () => {
    const { container } = render(<WalletBalanceWidget />);
    const trigger = container.querySelector("[role='button']") as HTMLElement;
    fireEvent.click(trigger);
    // Dropdown should not open since DROPDOWN_ENABLED is false
    expect(screen.queryByPlaceholderText("Search tokens...")).toBeNull();
  });

  it("trigger has aria-expanded and aria-haspopup", () => {
    const { container } = render(<WalletBalanceWidget />);
    const trigger = container.querySelector("[role='button']") as HTMLElement;
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
