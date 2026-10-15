"use client";

import { useMemo } from "react";
import { BSC_TOKENS } from "@/lib/token-registry";
import { PLATFORM_TOKEN_SYMBOL } from "@/lib/platform-token";
import { useTokenPricesApi, lookupPrice } from "./useTokenPricesApi";

/**
 * Fallback prices for tokens without API coverage.
 * Used as initial values before API responds.
 */
export const FALLBACK_PRICES: Record<string, string> = {
  BNB: "600.00",
  USDT: "1.00",
  USDC: "1.00",
  [PLATFORM_TOKEN_SYMBOL]: "0.10",
  MDAO: "0.035",
  DAI: "1.00",
  DSU: "1.00",
  DOGE: "0.32",
  PEPE: "0.000012",
  ADA: "0.68",
};

/**
 * BSC backward-compatible price hook.
 *
 * Returns `Record<symbol, string>` (e.g. `{ BNB: "616", USDT: "1.00" }`).
 * Signature & return format identical to the original Chainlink-based version.
 *
 * Internally fetches prices from backend batch_price API via useTokenPricesApi,
 * then extracts BSC token prices and converts keys from `chainId:address` → `symbol`.
 *
 * Existing consumers (DepositModal, useMultiChainPortfolio) require zero changes.
 */
export function useTokenPrices() {
  const { data: apiData, isLoading, isError } = useTokenPricesApi();

  const data: Record<string, string> = useMemo(() => {
    const result = { ...FALLBACK_PRICES };
    if (!apiData) return result;
    // Extract BSC token prices, convert key to symbol (backward compat)
    for (const token of BSC_TOKENS) {
      const price = lookupPrice(apiData, 56, token.address);
      if (price !== "0") result[token.symbol] = price;
    }
    return result;
  }, [apiData]);

  return { data, isLoading, isError };
}
