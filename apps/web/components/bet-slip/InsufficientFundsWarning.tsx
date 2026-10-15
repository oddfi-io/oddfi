"use client";

import { memo } from "react";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { useDepositSheetStore } from "@/stores/depositSheetStore";
import { useWalletSheetStore } from "@/stores/walletSheetStore";
import WarningRectIcon from "@/components/icons/WarningRectIcon";

interface InsufficientFundsWarningProps {
  /** H5: close the BetSlip sheet so deposit/connect UI isn't obscured */
  onRequestClose?: () => void;
}

function InsufficientFundsWarning({ onRequestClose }: InsufficientFundsWarningProps) {
  const { isConnected } = useAccount();
  const t = useTranslations("betSlip");
  const openDeposit = useDepositSheetStore((s) => s.open);
  const triggerConnect = useWalletSheetStore((s) => s.triggerConnect);

  const handleDeposit = () => {
    onRequestClose?.();
    if (!isConnected) {
      triggerConnect();
    } else {
      openDeposit();
    }
  };

  return (
    <div className="bg-tag-yellow rounded-8 p-[12px] flex gap-[8px] items-start">
      <WarningRectIcon size={20} className="text-fn-yellow shrink-0" />
      <div className="flex flex-col gap-[4px] items-start justify-center">
        <p className="text-[14px] leading-[19px] font-medium text-fn-yellow">
          {t("insufficientFundsWarning")}
        </p>
        <p className="text-[12px] leading-[18px] font-medium text-primary">
          <button type="button" onClick={handleDeposit} className="underline text-primary">
            {t("depositNow")}
          </button>
          <span> {t("toContinueBetting")}</span>
        </p>
      </div>
    </div>
  );
}

export default memo(InsufficientFundsWarning);
