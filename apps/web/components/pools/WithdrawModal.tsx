"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";
import { formatAmount, formatDisplayAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import type { Position } from "./types";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position | null;
}

export default function WithdrawModal({ isOpen, onClose, position }: WithdrawModalProps) {
  const t = useTranslations("pools");
  const [amount, setAmount] = useState("");

  if (!position) return null;

  const pnlPositive = position.pnl >= 0;
  const pnlSign = pnlPositive ? "+" : "";
  const pnlColorClass = pnlPositive ? "text-green" : "text-fn-red";

  // Parse currentValue numeric string (e.g. "34,820 ODD" → "34820")
  const currentValueRaw = position.currentValue.replace(/[^\d.]/g, "");

  const handleMax = () => setAmount(currentValueRaw);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
    }
  };

  const handleConfirm = () => {
    // DD-113: 认购模式短路兜底
    if (IS_SUBSCRIPTION_MODE) return;
    const num = parseFloat(amount);
    if (!amount || num <= 0) return;
    onClose();
    setAmount("");
  };

  const receiveDisplay =
    amount && parseFloat(amount) > 0
      ? `${formatDisplayAmount(amount)} ${PLATFORM_TOKEN_DISPLAY}`
      : `0.00 ${PLATFORM_TOKEN_DISPLAY}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Withdraw — Position">
      <div className="space-y-[16px] pb-[8px]">
        {/* Summary rows — no Unbonding Period for instant withdraw */}
        <div className="py-[16px]">
          <div className="flex justify-between py-[12px] border-b border-secondary">
            <span className="text-secondary text-[14px]">{t("currentValue")}</span>
            <span className="text-primary text-[14px]">{position.currentValue}</span>
          </div>
          <div className="flex justify-between py-[12px]">
            <span className="text-secondary text-[14px]">{t("netPnl")}</span>
            <span className={`text-[14px] ${pnlColorClass}`}>
              {pnlSign}
              {position.pnl}%
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <div className="flex items-center justify-between mb-[8px]">
            <span className="text-secondary text-[14px]">
              Withdraw Amount ({PLATFORM_TOKEN_DISPLAY})
            </span>
            <span className="text-secondary text-[14px]">
              Available{" "}
              <span className="text-primary font-semibold">
                {currentValueRaw ? formatAmount(currentValueRaw) : "0.00"} {PLATFORM_TOKEN_DISPLAY}
              </span>
            </span>
          </div>
          <div className="bg-fill-input rounded-12 h-[48px] px-[16px] flex items-center gap-[8px]">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={handleAmountChange}
              style={{ touchAction: "manipulation" }}
              className="flex-1 bg-transparent text-primary text-[16px] outline-none placeholder:text-tertiary min-w-0"
            />
            <span className="text-secondary text-[14px] shrink-0">{PLATFORM_TOKEN_DISPLAY}</span>
            <button
              onClick={handleMax}
              style={{ touchAction: "manipulation" }}
              className="text-brand-default text-[14px] font-semibold cursor-pointer shrink-0 min-h-[44px] flex items-center"
            >
              MAX
            </button>
          </div>
        </div>

        {/* You will receive */}
        <div className="bg-fill-card1 rounded-12 p-[16px] flex items-center justify-between">
          <div>
            <p className="text-secondary text-[14px]">{t("youWillReceive")}</p>
            <p className="text-tertiary text-[12px] mt-[2px]">Funds available immediately</p>
          </div>
          <p className="text-primary text-[20px] font-bold">{receiveDisplay}</p>
        </div>

        {/* CTA */}
        {/* DD-113: 认购模式强制 disabled */}
        <button
          onClick={handleConfirm}
          disabled={!amount || parseFloat(amount) <= 0 || IS_SUBSCRIPTION_MODE}
          style={{ touchAction: "manipulation" }}
          className="bg-btn-primary-white text-static-black rounded-12 h-[48px] w-full text-[16px] font-semibold disabled:opacity-40 transition-opacity"
        >
          {t("withdraw")}
        </button>
      </div>
    </Modal>
  );
}
