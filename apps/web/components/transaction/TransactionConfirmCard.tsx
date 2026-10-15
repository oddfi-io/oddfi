"use client";

import { useTranslations } from "next-intl";
import type { TxConfirmSummary } from "@/lib/proxy-wallet/types";
import { TransactionBreakdown } from "./TransactionBreakdown";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import { ChainIcon } from "@/components/ui/ChainIcon";

interface TransactionConfirmCardProps {
  summary: TxConfirmSummary;
  confirmLabel?: string;
  onConfirm: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function TransactionConfirmCard({
  summary,
  confirmLabel,
  onConfirm,
  isLoading = false,
  disabled = false,
}: TransactionConfirmCardProps) {
  const t = useTranslations("deposit");
  const label = confirmLabel || t("continue");
  return (
    <div className="w-full flex flex-col gap-[24px]">
      {/* Amount + send/receive card */}
      <div className="bg-[#252528] rounded-12 pt-[12px] pb-[16px] px-[16px] flex flex-col items-center gap-[24px]">
        {/* Amount */}
        <div className="flex items-center justify-center">
          <span className="text-[48px] font-bold text-white leading-[64px]">
            {summary.usdAmount}
          </span>
        </div>

        {/* Send / Get rows */}
        <div className="flex flex-col gap-[12px] w-full">
          <div className="flex items-center justify-between w-full">
            <span className="text-[14px] text-[#575966] leading-[19px]">{t("youSend")}</span>
            <div className="flex items-center gap-[8px]">
              <TokenIconWithChain
                tokenIconUrl={summary.sendIconUrl}
                tokenSymbol={summary.sendSymbol}
                chainIconUrl={summary.sendChainIconUrl ?? ""}
                size={20}
                mainIconTopOffset={2}
              />
              <span className="text-[14px] text-white leading-[19px]">
                {summary.sendAmount} {summary.sendSymbol}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between w-full">
            <span className="text-[14px] text-[#575966] leading-[19px]">{t("youGet")}</span>
            <div className="flex items-center gap-[8px]">
              <TokenIconWithChain
                tokenIconUrl={summary.receiveIconUrl}
                tokenSymbol={summary.receiveSymbol}
                chainIconUrl={summary.receiveChainIconUrl ?? ""}
                size={20}
                mainIconTopOffset={2}
              />
              <span className="text-[14px] text-white leading-[19px]">
                {summary.receiveAmount} {summary.receiveSymbol}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Source / Destination / Estimated time + Breakdown */}
      <div className="flex flex-col gap-[12px] w-full">
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-[#575966] leading-[19px]">{t("source")}</span>
          <div className="flex items-center gap-[8px]">
            <div className="shrink-0 size-[20px] rounded-[6px] overflow-hidden bg-white/10">
              {summary.sourceIconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={summary.sourceIconUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[8px] text-secondary">
                  W
                </div>
              )}
            </div>
            <span className="text-[14px] text-white leading-[19px]">{summary.sourceLabel}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[14px] text-[#575966] leading-[19px]">{t("destination")}</span>
          <div className="flex items-center gap-[8px]">
            <ChainIcon size={20} />
            <span className="text-[14px] text-white leading-[19px]">{summary.destLabel}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[14px] text-[#575966] leading-[19px]">{t("estimatedTime")}</span>
          <span className="text-[14px] text-white leading-[19px]">{summary.estimatedTime}</span>
        </div>

        <TransactionBreakdown
          networkCost={summary.networkCost}
          priceImpact={summary.priceImpact}
          maxSlippage={summary.maxSlippage}
        />
      </div>

      {/* Terms + Confirm */}
      <div className="flex flex-col items-center gap-[16px]">
        <p className="text-[12px] text-[#3d3d40] leading-[18px]">
          {t("termsNotice")} <span className="text-white cursor-pointer">{t("termsOfUse")}</span>
        </p>

        <button
          onClick={onConfirm}
          disabled={disabled || isLoading}
          className={[
            "w-full h-[48px] rounded-[10px] text-[14px] font-medium text-[#04060c] leading-[19px]",
            "shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] transition-opacity touch-manipulation",
            disabled || isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
          style={{ background: "white" }}
        >
          {isLoading ? t("processing") : label}
        </button>
      </div>
    </div>
  );
}
