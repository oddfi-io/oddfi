"use client";

import { useState } from "react";
import { formatAmount, formatCompact, isGt } from "@/lib/decimal";
import type { PortfolioToken } from "@/hooks/useMultiChainPortfolio";

interface TokenRowProps {
  token: PortfolioToken;
  isActive?: boolean;
  onSelect?: (symbol: string) => void;
}

export function TokenRow({ token, isActive, onSelect }: TokenRowProps) {
  const [imgError, setImgError] = useState(false);
  const [chainImgError, setChainImgError] = useState(false);
  const { meta, balance, usdValue, hasPriceData, chainIcon } = token;

  const displayUsd = !hasPriceData
    ? "$—"
    : isGt(usdValue, "1000")
      ? formatCompact(usdValue)
      : `$${formatAmount(usdValue, 2)}`;

  return (
    <div
      className={`flex items-center gap-3.5 px-4 py-3 min-h-[56px] transition-colors ${
        onSelect ? "cursor-pointer" : "cursor-default"
      } ${isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
      onClick={onSelect ? () => onSelect(meta.symbol) : undefined}
      role={onSelect ? "option" : undefined}
      aria-selected={onSelect ? isActive : undefined}
    >
      {/* Token icon with chain badge */}
      <div className="relative flex-shrink-0 w-10 h-10">
        {imgError ? (
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-base font-bold text-secondary">
            {meta.symbol[0]}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.iconUrl}
            alt={meta.symbol}
            width={40}
            height={40}
            className="rounded-full"
            onError={() => setImgError(true)}
          />
        )}
        {/* Chain badge */}
        {chainImgError || !chainIcon ? null : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={chainIcon}
            alt=""
            width={16}
            height={16}
            className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[var(--bg-primary)]"
            onError={() => setChainImgError(true)}
          />
        )}
      </div>

      {/* Symbol */}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-primary leading-tight">{meta.symbol}</div>
      </div>

      {/* Balance + USD */}
      <div className="text-right flex-shrink-0">
        <div className="text-[15px] font-semibold text-primary tabular-nums leading-tight">
          {formatAmount(balance, 2)}
        </div>
        <div className="text-xs text-secondary tabular-nums mt-0.5">{displayUsd}</div>
      </div>
    </div>
  );
}
