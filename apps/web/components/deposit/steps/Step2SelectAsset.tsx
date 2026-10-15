"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMultiChainPortfolio } from "@/hooks/useMultiChainPortfolio";
import type { PortfolioToken } from "@/hooks/useMultiChainPortfolio";
import type { TokenMeta } from "@/lib/token-registry";
import { isGt, formatAmount, formatBalance } from "@/lib/decimal";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";

const LOW_BALANCE_THRESHOLD_USD = 2;

interface Step2SelectAssetProps {
  selectedAsset: TokenMeta | null;
  onSelect: (asset: TokenMeta) => void;
  onContinue: () => void;
}

function AssetRow({
  item,
  isSelected,
  isLowBalance,
  onSelect,
  lowBalanceLabel,
}: {
  item: PortfolioToken;
  isSelected: boolean;
  isLowBalance: boolean;
  onSelect: () => void;
  lowBalanceLabel: string;
}) {
  const displayUsd = !item.hasPriceData ? "$—" : `$${formatAmount(item.usdValue, 2)}`;

  return (
    <button
      onClick={isLowBalance ? undefined : onSelect}
      disabled={isLowBalance}
      className={[
        "w-full flex items-center justify-between px-[8px] py-[12px] rounded-8",
        "transition-colors touch-manipulation",
        isLowBalance ? "cursor-not-allowed" : "hover:bg-[#1f2127] cursor-pointer",
        isSelected ? "bg-[#1f2127]" : "",
      ].join(" ")}
    >
      {/* Left: icon + symbol + balance */}
      <div className={`flex items-center gap-[12px] ${isLowBalance ? "opacity-30" : ""}`}>
        <TokenIconWithChain
          tokenIconUrl={item.meta.iconUrl}
          tokenSymbol={item.meta.symbol}
          chainIconUrl={item.chainIcon}
          size={32}
          mainIconTopOffset={2}
        />
        <div className="flex flex-col items-start justify-center">
          <span className="text-[14px] font-bold text-white leading-[19px]">
            {item.meta.symbol}
          </span>
          <span className="text-[12px] text-[#575966] leading-[18px]">
            {formatBalance(item.balance)} {item.meta.symbol}
          </span>
        </div>
      </div>
      {/* Right: low balance tag + USD value */}
      <div className="flex items-center gap-[12px]">
        {isLowBalance && (
          <span
            className="flex items-center justify-center h-[24px] px-[8px] rounded-8 text-[11px] font-medium text-tertiary"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            {lowBalanceLabel}
          </span>
        )}
        <span
          className={`text-[14px] font-bold text-white leading-[19px] ${isLowBalance ? "opacity-30" : ""}`}
        >
          {displayUsd}
        </span>
      </div>
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="w-full flex items-center gap-[12px] px-[8px] py-[12px]">
      <div className="size-[32px] rounded-full bg-white/10 animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="w-12 h-3.5 rounded bg-white/10 animate-pulse" />
        <div className="w-24 h-3 rounded bg-white/10 animate-pulse" />
      </div>
      <div className="w-16 h-4 rounded bg-white/10 animate-pulse" />
    </div>
  );
}

export function Step2SelectAsset({ selectedAsset, onSelect, onContinue }: Step2SelectAssetProps) {
  const t = useTranslations("deposit");
  const { portfolio, isLoading } = useMultiChainPortfolio();
  const [selectedKey, setSelectedKey] = useState<string | null>(
    selectedAsset ? `${selectedAsset.chainId}:${selectedAsset.symbol}` : null
  );

  // Show all tokens with balance > 0; low balance (< $1) items sorted to the bottom
  const displayTokens = portfolio
    .filter((item) => isGt(item.balance, "0"))
    .sort((a, b) => {
      const aLow = a.hasPriceData && !isGt(a.usdValue, String(LOW_BALANCE_THRESHOLD_USD));
      const bLow = b.hasPriceData && !isGt(b.usdValue, String(LOW_BALANCE_THRESHOLD_USD));
      if (aLow === bLow) return 0;
      return aLow ? 1 : -1;
    });

  const handleSelect = (token: PortfolioToken) => {
    const key = `${token.chainId}:${token.meta.symbol}`;
    setSelectedKey(key);
    onSelect(token.meta);
  };

  return (
    <div className="flex flex-col w-full gap-[16px]">
      {/* Asset list */}
      <div className="flex flex-col gap-[8px] max-h-[360px] overflow-y-auto">
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : displayTokens.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="text-[14px] text-[#575966] mb-1">{t("noTokensFound")}</div>
            <div className="text-[12px] text-[#3d3d40]">{t("transferToDeposit")}</div>
          </div>
        ) : (
          displayTokens.map((item) => {
            const key = `${item.chainId}:${item.meta.symbol}`;
            const lowBalance =
              item.hasPriceData && !isGt(item.usdValue, String(LOW_BALANCE_THRESHOLD_USD));
            return (
              <AssetRow
                key={key}
                item={item}
                isSelected={key === selectedKey}
                isLowBalance={lowBalance}
                lowBalanceLabel={t("lowBalance")}
                onSelect={() => handleSelect(item)}
              />
            );
          })
        )}
      </div>

      {/* Continue button — Figma: white bg, black text, rounded-[10px] */}
      <button
        onClick={onContinue}
        disabled={!selectedKey}
        className={[
          "w-full h-[48px] rounded-[10px] text-[14px] font-medium text-[#04060c] leading-[19px]",
          "shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] transition-opacity touch-manipulation",
          !selectedKey ? "opacity-15 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
        style={{ background: "white" }}
      >
        {t("continue")}
      </button>
    </div>
  );
}
