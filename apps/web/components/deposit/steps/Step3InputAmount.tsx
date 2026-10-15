"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { TokenMeta } from "@/lib/token-registry";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_SYMBOL } from "@/lib/platform-token";
import { CHAIN_ICON_MAP } from "@/lib/token-registry";
import { CORE_CHAIN } from "@/lib/chains";
import { mul, isGt, formatAmount } from "@/lib/decimal";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";

interface Step3InputAmountProps {
  selectedAsset: TokenMeta;
  assetUsdValue: string;
  usdAmount: string;
  onSetUsdAmount: (amount: string) => void;
  onContinue: () => void;
  isPlatformToken?: boolean;
}

const PERCENT_OPTIONS = [
  { label: "10%", value: "0.1" },
  { label: "25%", value: "0.25" },
  { label: "50%", value: "0.5" },
  { label: "100%", value: "1" },
  { label: "MAX", value: "1" },
];

const MIN_USD_AMOUNT = process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "2" : "0";

export function Step3InputAmount({
  selectedAsset,
  assetUsdValue,
  usdAmount,
  onSetUsdAmount,
  onContinue,
  isPlatformToken,
}: Step3InputAmountProps) {
  const t = useTranslations("deposit");
  const [error, setError] = useState<string | null>(null);

  const handlePercentClick = useCallback(
    (pct: string) => {
      const result = mul(assetUsdValue, pct);
      onSetUsdAmount(formatAmount(result, 2));
      setError(null);
    },
    [assetUsdValue, onSetUsdAmount]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9.]/g, "");
      onSetUsdAmount(raw);
      setError(null);
    },
    [onSetUsdAmount]
  );

  const handleContinue = useCallback(() => {
    const val = usdAmount.trim();

    if (!val || val === "0" || val === "0.") {
      setError(t("enterAmount"));
      return;
    }

    if (isGt(val, assetUsdValue)) {
      setError(t("insufficientBalance"));
      return;
    }

    if (isGt(MIN_USD_AMOUNT, val)) {
      onSetUsdAmount(MIN_USD_AMOUNT);
      setError(t("minimumAdjusted"));
      return;
    }

    setError(null);
    onContinue();
  }, [usdAmount, assetUsdValue, onSetUsdAmount, onContinue]);

  const hasAmount = !!usdAmount && usdAmount !== "0";
  const isInsufficient = hasAmount && isGt(usdAmount, assetUsdValue);
  const canContinue = hasAmount && !isInsufficient;

  return (
    <div className="flex flex-col items-center w-full gap-[24px]">
      {/* Amount input + percentage chips */}
      <div className="flex flex-col items-center w-full gap-[24px]">
        {/* Large amount display */}
        <div className="flex items-center justify-center">
          <span
            className={[
              "text-[48px] font-bold leading-[64px] text-center",
              hasAmount ? "text-white" : "text-tertiary",
            ].join(" ")}
          >
            $
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={usdAmount}
            onChange={handleInputChange}
            placeholder="0"
            className={[
              "bg-transparent outline-none text-center font-bold text-[48px] leading-[64px]",
              "w-[120px] caret-[#5972fe]",
              hasAmount ? "text-white" : "text-tertiary",
              "placeholder:text-tertiary",
            ].join(" ")}
            autoFocus
          />
        </div>

        {/* Percentage chips — 5 equal-width */}
        <div className="flex gap-[8px] h-[28px] w-full">
          {PERCENT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => handlePercentClick(opt.value)}
              className="flex-1 flex items-center justify-center h-full
                         rounded-8 bg-[#252528] text-[12px] font-medium text-white leading-[18px]
                         hover:bg-[#303033] transition-colors touch-manipulation cursor-pointer"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Send / Get card */}
      <div className="w-full border border-[#37393a] rounded-16 p-[16px] flex items-center justify-between">
        {/* Send side */}
        <div className="flex items-center gap-[12px]">
          <TokenIconWithChain
            tokenIconUrl={selectedAsset.iconUrl}
            tokenSymbol={selectedAsset.symbol}
            chainIconUrl={CHAIN_ICON_MAP[selectedAsset.chainId] ?? ""}
            size={32}
            mainIconTopOffset={2}
          />
          <div className="flex flex-col items-start justify-center">
            <span className="text-[12px] text-[#575966] leading-[18px]">{t("send")}</span>
            <span className="text-[14px] font-bold text-white leading-[19px]">
              {selectedAsset.symbol}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <ArrowRightIcon size={16} className="opacity-60 text-white" />

        {/* Get side */}
        {!isPlatformToken && (
          <div className="flex items-center gap-[12px]">
            <TokenIconWithChain
              tokenIconUrl={PLATFORM_TOKEN.iconUrl}
              tokenSymbol={PLATFORM_TOKEN_SYMBOL}
              chainIconUrl={CHAIN_ICON_MAP[CORE_CHAIN.id] ?? ""}
              size={32}
              mainIconTopOffset={2}
            />
            <div className="flex flex-col items-start justify-center">
              <span className="text-[12px] text-[#575966] leading-[18px]">{t("get")}</span>
              <span className="text-[14px] font-bold text-white leading-[19px]">
                {PLATFORM_TOKEN_SYMBOL}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error + Button */}
      <div className="flex flex-col items-center gap-[16px] w-full">
        {/* Error message */}
        {error && <div className="text-[12px] text-orange-400 text-center">{error}</div>}

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className={[
            "w-full h-[48px] rounded-[10px] text-[14px] font-medium text-[#04060c] leading-[19px]",
            "shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] transition-opacity touch-manipulation",
            !canContinue ? "opacity-30 cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
          style={{ background: "white" }}
        >
          {isInsufficient ? t("insufficientBalance") : t("continue")}
        </button>
      </div>
    </div>
  );
}
