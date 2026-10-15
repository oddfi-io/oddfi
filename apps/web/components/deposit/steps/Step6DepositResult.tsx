"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import type { TxResultData } from "@/stores/depositSheetStore";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import { ChainIcon } from "@/components/ui/ChainIcon";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
function shortAddr(addr: string): string {
  return `...${addr.slice(-4)}`;
}

interface Step6DepositResultProps {
  txResult: TxResultData;
  onContinueDeposit: () => void;
  onViewPortfolio: () => void;
}

export function Step6DepositResult({
  txResult,
  onContinueDeposit,
  onViewPortfolio,
}: Step6DepositResultProps) {
  const t = useTranslations("deposit");
  const sourceDisplay = `${t("wallet")} (${shortAddr(txResult.sourceAddress)})`;
  const destDisplay = `${t("oddWallet")} (${shortAddr(txResult.destAddress)})`;

  return (
    <div className="flex flex-col items-center w-full gap-[24px]">
      {/* Success icon */}
      <Image
        src="/images/deposit/success.png"
        alt=""
        width={80}
        height={80}
        sizes="80px"
        className="shrink-0"
      />

      {/* Title + subtitle */}
      <div className="flex flex-col items-center gap-[12px] text-center w-[250px]">
        <p className="text-[18px] font-bold text-white leading-[26px] w-full">
          {t("depositConfirming")}
        </p>
        <p className="text-[14px] text-[#606063] leading-[19px] w-full">{t("fundsArrive")}</p>
      </div>

      {/* Summary card */}
      <div className="w-full border border-[#212124] rounded-12 p-[16px] flex flex-col gap-[12px]">
        <div className="flex items-center justify-between h-[20px]">
          <span className="text-[14px] text-[#5c5d61] leading-[19px]">{t("youSend")}</span>
          <div className="flex items-center gap-[8px]">
            {txResult.sendIconUrl && (
              <Image
                src={txResult.sendIconUrl}
                alt={txResult.sendSymbol}
                width={20}
                height={20}
                sizes="20px"
                className="size-[20px] rounded-full"
              />
            )}
            <span className="text-[14px] font-bold text-white leading-[19px]">
              {txResult.sendAmount}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between h-[20px]">
          <span className="text-[14px] text-[#5c5d61] leading-[19px]">{t("youGet")}</span>
          <div className="flex items-center gap-[8px]">
            <TokenIconWithChain
              tokenIconUrl={PLATFORM_TOKEN.iconUrl}
              tokenSymbol={PLATFORM_TOKEN_DISPLAY}
              size={20}
              hideChainBadge
            />
            <span className="text-[14px] font-bold text-white leading-[19px]">
              {txResult.receiveAmount}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between h-[20px]">
          <span className="text-[14px] text-[#5c5d61] leading-[19px]">{t("source")}</span>
          <div className="flex items-center gap-[8px]">
            {txResult.sourceIconUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={txResult.sourceIconUrl} alt="" className="size-[20px] rounded-8" />
            ) : (
              <div className="size-[20px] rounded-8 bg-white/10 flex items-center justify-center text-[10px] text-secondary">
                W
              </div>
            )}
            <span className="text-[14px] text-white leading-[19px]">{sourceDisplay}</span>
          </div>
        </div>

        <div className="flex items-center justify-between h-[20px]">
          <span className="text-[14px] text-[#5c5d61] leading-[19px]">{t("destination")}</span>
          <div className="flex items-center gap-[8px]">
            <ChainIcon size={20} />
            <span className="text-[14px] text-white leading-[19px]">{destDisplay}</span>
          </div>
        </div>

        <div className="flex items-center justify-between h-[19px]">
          <span className="text-[14px] text-[#5c5d61] leading-[19px]">{t("estimatedTime")}</span>
          <span className="text-[14px] text-white leading-[19px]">{t("lessThan1Min")}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-start gap-[16px] w-full">
        <button
          onClick={onContinueDeposit}
          className="flex-1 h-[48px] rounded-12 bg-[#212124] text-[14px] font-medium text-white leading-[19px]
                     shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] cursor-pointer touch-manipulation"
        >
          {t("continueDeposit")}
        </button>
        <button
          onClick={onViewPortfolio}
          className="flex-1 h-[48px] rounded-12 bg-white text-[14px] font-medium text-[#04060c] leading-[19px]
                     shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] cursor-pointer touch-manipulation"
        >
          {t("viewPortfolio")}
        </button>
      </div>
    </div>
  );
}
