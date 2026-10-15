import { bsc, arbitrum, mainnet, polygon, base } from "wagmi/chains";
import type { Chain } from "viem";
import type { PortfolioToken } from "@/hooks/useMultiChainPortfolio";

export const CHAIN_FALLBACK_PRIORITY: readonly Chain[] = [
  bsc,
  arbitrum,
  mainnet,
  polygon,
  base,
] as const;

export const CHAIN_FALLBACK_PRIORITY_IDS = CHAIN_FALLBACK_PRIORITY.map((c) => c.id);

export function pickFallbackChainId(availableChainIds: number[]): number {
  for (const id of CHAIN_FALLBACK_PRIORITY_IDS) {
    if (availableChainIds.includes(id)) return id;
  }
  return CHAIN_FALLBACK_PRIORITY_IDS[0];
}

/**
 * Choose default From asset:
 *   - Empty portfolio → undefined
 *   - Else pick the highest priority chain that appears in the portfolio,
 *     then return the first asset (portfolio is pre-sorted USD desc).
 */
export function pickDefaultFromAsset(portfolio: PortfolioToken[]): PortfolioToken | undefined {
  if (portfolio.length === 0) return undefined;
  const available = Array.from(new Set(portfolio.map((p) => p.chainId)));
  const chainId = pickFallbackChainId(available);
  return portfolio.find((p) => p.chainId === chainId);
}
