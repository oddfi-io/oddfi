"use client";

import { useQuery } from "@tanstack/react-query";
import { getBatchTokenPrices } from "@/lib/api";
import type { BatchPriceReq } from "@/lib/api";
import { TOKEN_REGISTRY, CHAIN_ID_MAP, CHAIN_ID_REVERSE_MAP } from "@/lib/token-registry";
import { IS_TESTNET } from "@/lib/network-mode";

// ============================================================
// Price key utilities
// ============================================================

/** Unique price key: `chainId:lowercaseAddress` */
export type PriceKey = `${number}:${string}`;

export function makePriceKey(chainId: number, address: string): PriceKey {
  return `${chainId}:${address.toLowerCase()}`;
}

export interface TokenPriceData {
  prices: Record<string, string>;
  tokenIcons: Record<string, string>;
  chainIcons: Record<string, string>;
}

/** Look up a price from the price map by chainId + address */
export function lookupPrice(
  data: TokenPriceData | undefined,
  chainId: number,
  address: string
): string {
  return data?.prices[makePriceKey(chainId, address)] ?? "0";
}

/** Look up a token icon URL from the API data */
export function lookupTokenIcon(
  data: TokenPriceData | undefined,
  chainId: number,
  address: string
): string | undefined {
  return data?.tokenIcons[makePriceKey(chainId, address)];
}

/** Look up a chain icon URL from the API data */
export function lookupChainIcon(
  data: TokenPriceData | undefined,
  chainId: number,
  address: string
): string | undefined {
  return data?.chainIcons[makePriceKey(chainId, address)];
}

// ============================================================
// Static query list (module-level constant — referentially stable)
// ============================================================

// 后端 batch_price 只覆盖主网代币（bsc/eth/polygon_pos/arbitrum/base），
// testnet 链（如 bsc_testnet）请求会 400，需在构造请求时整链过滤掉。
const ALL_TOKENS_FOR_PRICING: BatchPriceReq["tokens"] = Object.entries(TOKEN_REGISTRY).flatMap(
  ([chainId, tokens]) => {
    const backendChainId = CHAIN_ID_MAP[Number(chainId)] ?? String(chainId);
    if (backendChainId.includes("testnet")) return [];
    return tokens.map((t) => ({
      chain_id: backendChainId,
      address: t.address,
    }));
  }
);

// ============================================================
// Hook
// ============================================================

/**
 * Fetch token USD prices from backend batch_price API.
 * Returns a map keyed by `chainId:address` (lowercase).
 *
 * Consumers:
 * - useTokenPrices() — BSC backward-compat layer (symbol key)
 * - useMultiChainPortfolio() — multi-chain (Batch 2+)
 */
export function useTokenPricesApi() {
  return useQuery({
    queryKey: ["tokenPrices", "batch"] as const,
    queryFn: async (): Promise<TokenPriceData> => {
      const items = await getBatchTokenPrices({ tokens: ALL_TOKENS_FOR_PRICING });
      const prices: Record<string, string> = {};
      const tokenIcons: Record<string, string> = {};
      const chainIcons: Record<string, string> = {};
      for (const item of items) {
        const numericChainId = CHAIN_ID_REVERSE_MAP[item.chain_id];
        if (numericChainId == null) continue;
        const key = makePriceKey(numericChainId, item.address);
        prices[key] = item.price;
        if (item.token_image_url) tokenIcons[key] = item.token_image_url;
        if (item.chain_image_url) chainIcons[key] = item.chain_image_url;
      }
      return { prices, tokenIcons, chainIcons };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: !IS_TESTNET,
  });
}
