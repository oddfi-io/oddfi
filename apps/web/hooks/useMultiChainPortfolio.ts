"use client";

import { useMemo } from "react";
import { useMultiChainBalances } from "./useMultiChainBalances";
import {
  useTokenPricesApi,
  lookupPrice,
  lookupTokenIcon,
  lookupChainIcon,
} from "./useTokenPricesApi";
import { CHAIN_ICON_MAP } from "@/lib/token-registry";
import type { TokenMeta } from "@/lib/token-registry";
import { mul, isGt } from "@/lib/decimal";

export interface PortfolioToken {
  meta: TokenMeta;
  chainId: number;
  chainIcon: string;
  balance: string;
  usdValue: string;
  /** Whether batch_price API returned a price for this token */
  hasPriceData: boolean;
}

/**
 * Multi-chain portfolio: combines balances from all BALANCE_READ_CHAINS
 * with USD prices from batch_price API + ODD price.
 *
 * Returns tokens sorted by USD value (desc), filtered to non-zero balances.
 */
export function useMultiChainPortfolio() {
  const { balances, isLoading: balLoading } = useMultiChainBalances();
  const { data: priceData, isLoading: priceLoading } = useTokenPricesApi();

  const portfolio: PortfolioToken[] = useMemo(() => {
    return balances
      .map((b) => {
        const price = lookupPrice(priceData, b.chainId, b.meta.address);
        const hasPriceData = price !== "0";
        const usdValue = hasPriceData ? mul(b.balance, price) : "0";

        // Prefer API icons, fall back to local registry
        const tokenIcon = lookupTokenIcon(priceData, b.chainId, b.meta.address);
        const chainIcon = lookupChainIcon(priceData, b.chainId, b.meta.address);

        return {
          meta: tokenIcon ? { ...b.meta, iconUrl: tokenIcon } : b.meta,
          chainId: b.chainId,
          chainIcon: chainIcon ?? CHAIN_ICON_MAP[b.chainId] ?? "",
          balance: b.balance,
          usdValue,
          hasPriceData,
        };
      })
      .filter((t) => isGt(t.balance, "0"))
      .sort((a, b) => {
        // USD value desc
        if (isGt(a.usdValue, b.usdValue)) return -1;
        if (isGt(b.usdValue, a.usdValue)) return 1;
        // Fallback: tier desc
        return b.meta.tier - a.meta.tier;
      });
  }, [balances, priceData]);

  return { portfolio, isLoading: balLoading || priceLoading };
}
