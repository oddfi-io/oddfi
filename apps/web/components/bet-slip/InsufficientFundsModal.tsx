"use client";

import { memo } from "react";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { XIcon } from "@phosphor-icons/react";
import { formatAmount } from "@/lib/decimal";
import { useDepositSheetStore } from "@/stores/depositSheetStore";
import { useWalletSheetStore } from "@/stores/walletSheetStore";

interface InsufficientFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  required: string;
  available: string;
  /** H5: close the BetSlip sheet so deposit/connect UI isn't obscured */
  onRequestClose?: () => void;
}

function InsufficientFundsModal({
  isOpen,
  onClose,
  required,
  available,
  onRequestClose,
}: InsufficientFundsModalProps) {
  const { isConnected } = useAccount();
  const t = useTranslations("betSlip");
  const openDeposit = useDepositSheetStore((s) => s.open);
  const triggerConnect = useWalletSheetStore((s) => s.triggerConnect);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Content */}
      {/* @figma-hardcoded: #191b20 modal-card-bg — pending design token */}
      <div
        className="relative w-full max-w-sm rounded-12 p-5 space-y-4"
        style={{ background: "#191b20", border: "1px solid rgba(255,255,255,0.12)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-primary">{t("insufficientFundsTitle")}</h3>
          <button
            className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-3 -mt-3 rounded-8 hover:bg-white/[0.06] transition-colors"
            onClick={onClose}
          >
            <XIcon size={18} className="text-secondary" />
          </button>
        </div>

        <p className="text-sm text-secondary">
          {t.rich("insufficientFundsDesc", {
            required: formatAmount(required, 2),
            available: formatAmount(available, 2),
            b: (chunks) => <span className="text-primary font-medium">{chunks}</span>,
          })}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-8 text-sm font-medium
              bg-white/[0.06] border border-white/[0.12] text-secondary hover:bg-white/[0.14] transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={() => {
              onClose();
              onRequestClose?.();
              if (!isConnected) {
                triggerConnect();
              } else {
                openDeposit();
              }
            }}
            className="flex-1 min-h-[44px] rounded-8 text-sm font-semibold
              bg-fn-brand text-static-black hover:bg-fn-brand/80 transition-colors"
          >
            {t("deposit")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(InsufficientFundsModal);
