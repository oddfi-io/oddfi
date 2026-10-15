"use client";

import { useQuery } from "@tanstack/react-query";
import type { TokenMeta } from "@/lib/token-registry";

type RelayCurrency = {
  chainId?: number;
  address?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  metadata?: { logoURI?: string; verified?: boolean; isNative?: boolean };
};

async function fetchRelayTokenList(chainId: number): Promise<TokenMeta[]> {
  const res = await fetch("/api/relay/currencies/v1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chainIds: [chainId], defaultList: true, verified: true }),
  });
  if (!res.ok) {
    throw new Error(`[useRelayTokenList] Failed to fetch token list — status ${res.status}`);
  }
  // Response is (RelayCurrency[])[] — outer array is grouped results; flatten before processing
  const raw: RelayCurrency[][] = await res.json();
  return raw
    .flat()
    .filter(
      (c): c is RelayCurrency & { address: string; symbol: string; decimals: number } =>
        c.chainId === chainId &&
        typeof c.address === "string" &&
        typeof c.symbol === "string" &&
        typeof c.decimals === "number"
    )
    .map(
      (c, idx): TokenMeta => ({
        chainId,
        symbol: c.symbol,
        name: c.name ?? c.symbol,
        address: c.address as `0x${string}`,
        decimals: c.decimals,
        iconUrl: c.metadata?.logoURI ?? "",
        tier: 100 - idx, // preserve API ordering; higher tier shown first among zero-balance tokens
        isNative: c.metadata?.isNative ?? false,
      })
    );
}

/**
 * Fetches the bridgeable token list from Relay API for a given source chain.
 *
 * Used by Step2SelectAsset when the user is connected to a non-BSC chain.
 * Results are cached for 5 minutes — token lists change infrequently.
 */
export function useRelayTokenList(chainId: number | undefined) {
  return useQuery({
    queryKey: ["relay-token-list", chainId],
    queryFn: () => fetchRelayTokenList(chainId!),
    enabled: !!chainId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
