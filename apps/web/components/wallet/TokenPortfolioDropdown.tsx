"use client";

import { useState, useMemo } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { DEFAULT_CHAIN_META } from "@/lib/chain-registry";
import { TokenRow } from "./TokenRow";
import type { PortfolioToken } from "@/hooks/useMultiChainPortfolio";

interface TokenPortfolioDropdownProps {
  portfolio: PortfolioToken[];
  isLoading: boolean;
  isClosing?: boolean;
  onAnimationEnd?: () => void;
  activeSymbol?: string | null;
  onSelectToken?: (symbol: string) => void;
  onAddFunds?: () => void;
}

export function TokenPortfolioDropdown({
  portfolio,
  isLoading,
  isClosing = false,
  onAnimationEnd,
  activeSymbol,
  onSelectToken,
  onAddFunds,
}: TokenPortfolioDropdownProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return portfolio;
    return portfolio.filter(
      (t) => t.meta.symbol.toLowerCase().includes(q) || t.meta.name.toLowerCase().includes(q)
    );
  }, [portfolio, search]);

  return (
    <div
      className={`absolute top-full right-0 mt-2 w-[340px] rounded-16 border border-white/[0.12] bg-[rgba(12,12,18,0.96)] shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-2xl overflow-hidden z-50 ${
        isClosing ? "animate-dropdown-out" : "animate-dropdown-in"
      }`}
      onAnimationEnd={onAnimationEnd}
    >
      {/* Search */}
      <div className="p-3 pb-2">
        <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-12 px-3.5 min-h-[44px] focus-within:border-white/20 transition-colors">
          <MagnifyingGlassIcon
            size={16}
            className="text-tertiary flex-shrink-0"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Search tokens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-primary placeholder:text-tertiary outline-none"
          />
        </div>
      </div>

      {/* Network pills */}
      <div className="px-4 pb-2">
        <div className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1.5">
          Network
        </div>
        <div className="flex gap-2">
          <button className="flex items-center px-3 min-h-[44px] rounded-8 bg-tag-brand border border-dt-hover/30 text-brand-default text-xs font-semibold touch-manipulation">
            All
          </button>
          <button className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-8 bg-white/[0.04] border border-white/[0.08] text-secondary text-xs font-medium touch-manipulation">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DEFAULT_CHAIN_META.iconUrl}
              alt=""
              width={14}
              height={14}
              className="rounded-full"
            />
            BNB Chain
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-white/[0.06]" />

      {/* Section label */}
      <div className="px-4 pt-2.5 pb-1">
        <div className="text-[11px] font-medium text-tertiary uppercase tracking-wider">Tokens</div>
      </div>

      {/* Token list */}
      <div className="max-h-[360px] overflow-y-auto pb-1 scrollbar-thin">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 px-4 py-3 min-h-[56px]">
              <div className="w-10 h-10 rounded-full bg-white/[0.06] animate-pulse flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-14 bg-white/[0.06] rounded animate-pulse" />
              </div>
              <div className="text-right space-y-1">
                <div className="h-4 w-12 bg-white/[0.06] rounded animate-pulse" />
                <div className="h-3 w-10 bg-white/[0.06] rounded animate-pulse" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-secondary text-sm">No tokens found</div>
        ) : (
          filtered.map((token) => (
            <TokenRow
              key={`${token.chainId}:${token.meta.symbol}`}
              token={token}
              isActive={activeSymbol === token.meta.symbol}
              onSelect={onSelectToken}
            />
          ))
        )}
      </div>

      {/* Add Funds button */}
      <div className="p-3 pt-1">
        <button
          className="w-full h-11 rounded-12 bg-fn-brand font-semibold text-sm text-static-black touch-manipulation hover:bg-fn-brand/90 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onAddFunds?.();
          }}
        >
          Add Funds
        </button>
      </div>
    </div>
  );
}
