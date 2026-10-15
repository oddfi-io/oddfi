// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTokenPrices, FALLBACK_PRICES } from "./useTokenPrices";
import { makePriceKey } from "./useTokenPricesApi";

// Mock useTokenPricesApi — the underlying data source
const mockUseTokenPricesApi = vi.fn();
vi.mock("./useTokenPricesApi", async () => {
  const actual = await vi.importActual("./useTokenPricesApi");
  return { ...actual, useTokenPricesApi: (...args: unknown[]) => mockUseTokenPricesApi(...args) };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "TestQueryWrapper";
  return Wrapper;
}

/** Build a price map entry for BSC (chainId=56) */
function bscPrice(address: string, price: string): [string, string] {
  return [makePriceKey(56, address), price];
}

describe("useTokenPrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converts API prices from chainId:address key to symbol key", () => {
    const prices = Object.fromEntries([
      bscPrice("0x0000000000000000000000000000000000000000", "612.50"), // BNB
      bscPrice("0x55d398326f99059fF775485246999027B3197955", "1.0001"), // USDT
      bscPrice("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", "0.9999"), // USDC
    ]);
    mockUseTokenPricesApi.mockReturnValue({
      data: { prices, tokenIcons: {}, chainIcons: {} },
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useTokenPrices(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data.BNB).toBe("612.50");
    expect(result.current.data.USDT).toBe("1.0001");
    expect(result.current.data.USDC).toBe("0.9999");
    // Tokens not in API response use fallback
    expect(result.current.data.MDAO).toBe(FALLBACK_PRICES.MDAO);
    expect(result.current.data.PEPE).toBe(FALLBACK_PRICES.PEPE);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns FALLBACK_PRICES when API has no data", () => {
    mockUseTokenPricesApi.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    const { result } = renderHook(() => useTokenPrices(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(FALLBACK_PRICES);
    expect(result.current.isError).toBe(true);
  });

  it("returns FALLBACK_PRICES while loading", () => {
    mockUseTokenPricesApi.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { result } = renderHook(() => useTokenPrices(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(FALLBACK_PRICES);
    expect(result.current.isLoading).toBe(true);
  });

  it("skips tokens with price '0' and keeps fallback", () => {
    const prices = Object.fromEntries([
      bscPrice("0x0000000000000000000000000000000000000000", "605.00"), // BNB
      // USDT not in response → lookupPrice returns "0" → fallback used
    ]);
    mockUseTokenPricesApi.mockReturnValue({
      data: { prices, tokenIcons: {}, chainIcons: {} },
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useTokenPrices(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data.BNB).toBe("605.00");
    expect(result.current.data.USDT).toBe(FALLBACK_PRICES.USDT);
    expect(result.current.data.MDAO).toBe(FALLBACK_PRICES.MDAO);
  });

  it("handles empty API price map", () => {
    mockUseTokenPricesApi.mockReturnValue({
      data: { prices: {}, tokenIcons: {}, chainIcons: {} },
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useTokenPrices(), {
      wrapper: createWrapper(),
    });

    // All fall back
    expect(result.current.data).toEqual(FALLBACK_PRICES);
  });
});
