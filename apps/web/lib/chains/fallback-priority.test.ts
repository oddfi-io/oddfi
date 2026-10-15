import { describe, it, expect } from "vitest";
import {
  CHAIN_FALLBACK_PRIORITY_IDS,
  pickFallbackChainId,
  pickDefaultFromAsset,
} from "./fallback-priority";
import type { PortfolioToken } from "@/hooks/useMultiChainPortfolio";

// Chain IDs
const BSC = 56;
const ARB = 42161;
const ETH = 1;
const POLYGON = 137;
const BASE = 8453;

function makeToken(chainId: number, symbol: string): PortfolioToken {
  return {
    meta: {
      symbol,
      address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      name: symbol,
      decimals: 18,
      tier: 1,
      isNative: false,
      iconUrl: "",
      chainId,
    },
    chainId,
    chainIcon: "",
    balance: "1",
    usdValue: "100",
    hasPriceData: true,
  };
}

describe("CHAIN_FALLBACK_PRIORITY_IDS", () => {
  it("has BSC as the first priority", () => {
    expect(CHAIN_FALLBACK_PRIORITY_IDS[0]).toBe(BSC);
  });

  it("contains Arbitrum, Ethereum, Polygon, Base", () => {
    expect(CHAIN_FALLBACK_PRIORITY_IDS).toContain(ARB);
    expect(CHAIN_FALLBACK_PRIORITY_IDS).toContain(ETH);
    expect(CHAIN_FALLBACK_PRIORITY_IDS).toContain(POLYGON);
    expect(CHAIN_FALLBACK_PRIORITY_IDS).toContain(BASE);
  });
});

describe("pickFallbackChainId", () => {
  it("returns BSC when [56] is provided", () => {
    expect(pickFallbackChainId([BSC])).toBe(BSC);
  });

  it("returns Arbitrum when [42161, 137] — Arbitrum wins over Polygon", () => {
    expect(pickFallbackChainId([ARB, POLYGON])).toBe(ARB);
  });

  it("returns BSC default when empty array", () => {
    expect(pickFallbackChainId([])).toBe(BSC);
  });

  it("returns Polygon when [137, 8453] — Polygon wins over Base per priority order", () => {
    expect(pickFallbackChainId([POLYGON, BASE])).toBe(POLYGON);
  });

  it("returns Ethereum when [1] is provided", () => {
    expect(pickFallbackChainId([ETH])).toBe(ETH);
  });

  it("returns BSC over all others when BSC is present", () => {
    expect(pickFallbackChainId([BASE, POLYGON, ETH, ARB, BSC])).toBe(BSC);
  });
});

describe("pickDefaultFromAsset", () => {
  it("returns undefined for empty portfolio", () => {
    expect(pickDefaultFromAsset([])).toBeUndefined();
  });

  it("returns BSC USDT when portfolio has [BSC USDT, ARB USDC]", () => {
    const portfolio: PortfolioToken[] = [makeToken(BSC, "USDT"), makeToken(ARB, "USDC")];
    const result = pickDefaultFromAsset(portfolio);
    expect(result?.chainId).toBe(BSC);
    expect(result?.meta.symbol).toBe("USDT");
  });

  it("returns ARB USDC when only ARB USDC in portfolio", () => {
    const portfolio: PortfolioToken[] = [makeToken(ARB, "USDC")];
    const result = pickDefaultFromAsset(portfolio);
    expect(result?.chainId).toBe(ARB);
    expect(result?.meta.symbol).toBe("USDC");
  });

  it("picks the first matching asset on the priority chain (portfolio is USD-sorted)", () => {
    // Two BSC tokens — should pick the first one in portfolio order
    const portfolio: PortfolioToken[] = [
      makeToken(BSC, "BNB"),
      makeToken(BSC, "USDT"),
      makeToken(ARB, "USDC"),
    ];
    const result = pickDefaultFromAsset(portfolio);
    expect(result?.chainId).toBe(BSC);
    expect(result?.meta.symbol).toBe("BNB");
  });

  it("falls back to next priority chain when BSC not in portfolio", () => {
    const portfolio: PortfolioToken[] = [makeToken(ARB, "USDC"), makeToken(POLYGON, "MATIC")];
    const result = pickDefaultFromAsset(portfolio);
    // ARB has higher priority than POLYGON
    expect(result?.chainId).toBe(ARB);
    expect(result?.meta.symbol).toBe("USDC");
  });
});
