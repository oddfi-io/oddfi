// [TEMP:staking] Temporary — will be replaced when backend staking API is ready
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { XIcon, WarningCircleIcon } from "@phosphor-icons/react";
import Modal from "@/components/ui/Modal";
import MobileBottomSheet from "@/components/ui/MobileBottomSheet";
import { mul, formatAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { formatOfi } from "./calc";
import type { StakingPosition } from "./types";

interface EarlyUnstakeModalProps {
  position: StakingPosition | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const PENALTY_PCT = "10";

// ── Shared content (PC + H5) ──────────────────────────────────────────────────
function EarlyUnstakeContent({
  position,
  onClose,
  onConfirm,
  isMobile,
}: {
  position: StakingPosition;
  onClose: () => void;
  onConfirm: () => void;
  isMobile: boolean;
}) {
  const t = useTranslations("staking");
  const penaltyAmount = formatAmount(mul(mul(position.earned, PENALTY_PCT), "0.01"), 2);
  const receiveAmount = formatOfi(position.amount);

  return (
    <div className={isMobile ? "relative" : ""}>
      {/* Close button — only for H5 (PC uses Modal's built-in close) */}
      {isMobile && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-[16px] right-[16px] bg-fill-input-modal flex items-center justify-center rounded-8 size-[24px]"
          style={{ touchAction: "manipulation" }}
          aria-label="Close"
        >
          <XIcon size={16} className="text-primary" />
        </button>
      )}

      {/* Content */}
      <div
        className={[
          "flex flex-col items-center",
          isMobile ? "gap-[24px] px-[16px] pt-[24px] pb-[24px]" : "gap-[24px]",
        ].join(" ")}
      >
        {/* Title — centered */}
        <h3
          className={[
            "text-center font-bold text-primary",
            isMobile ? "text-[16px] leading-[24px]" : "text-[18px] leading-[26px]",
          ].join(" ")}
        >
          {t("earlyUnstakeTitle")}
        </h3>

        {/* Detail rows */}
        <div className="flex flex-col gap-[16px] w-full">
          <div className="flex flex-col gap-[12px]">
            {/* Staked Amount */}
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-secondary leading-[19px]">{t("stakedAmount")}</span>
              <span className="text-[14px] text-primary leading-[19px]">
                {formatOfi(position.amount)} {PLATFORM_TOKEN_DISPLAY}
              </span>
            </div>

            {/* Lock Period */}
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-secondary leading-[19px]">{t("lockPeriod")}</span>
              <span className="text-[14px] text-primary leading-[19px]">
                {position.lockDays}
                {t("daysShort")} ({position.multiplier}x)
              </span>
            </div>

            {/* Earned So Far */}
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-secondary leading-[19px]">{t("earnedSoFar")}</span>
              <span className="text-[14px] font-medium text-green leading-[19px]">
                {formatOfi(position.earned)} {PLATFORM_TOKEN_DISPLAY}
              </span>
            </div>

            {/* Penalty */}
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-secondary leading-[19px]">{t("penalty")}</span>
              <span className="text-[14px] text-red leading-[19px]">
                -{penaltyAmount} {PLATFORM_TOKEN_DISPLAY}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-divider-light" />

          {/* You will receive */}
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-secondary leading-[19px]">{t("youWillReceive")}</span>
            <span className="text-[16px] font-medium text-primary leading-[24px]">
              {receiveAmount} {PLATFORM_TOKEN_DISPLAY}
            </span>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-tag-yellow rounded-8 p-[12px] flex gap-[8px] items-start w-full">
          {/* @figma-hardcoded: #f1c409 warning-text — pending design token */}
          <WarningCircleIcon size={20} className="text-[#f1c409] shrink-0 mt-[1px]" />
          <p className="text-[12px] leading-[18px] text-[#f1c409]">
            {/* @figma-hardcoded: #f1c409 warning-text — pending design token */}
            Early unstaking forfeits {PENALTY_PCT}% of accrued rewards. Your principal will be
            returned in full.
          </p>
        </div>

        {/* Confirm button */}
        <button
          type="button"
          onClick={onConfirm}
          className={[
            "bg-fn-red text-white font-medium h-[48px] rounded-12 shadow-xs transition-opacity hover:opacity-90 text-[14px]",
            "w-full",
          ].join(" ")}
          style={{ touchAction: "manipulation" }}
        >
          {t("confirmEarlyUnstake")}
        </button>
      </div>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────
export default function EarlyUnstakeModal({
  position,
  isOpen,
  onClose,
  onConfirm,
}: EarlyUnstakeModalProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!isOpen || !position) return null;

  if (isDesktop) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} hideHeader className="!max-w-[440px]">
        <EarlyUnstakeContent
          position={position}
          onClose={onClose}
          onConfirm={onConfirm}
          isMobile={false}
        />
      </Modal>
    );
  }

  return (
    <MobileBottomSheet open={isOpen} onClose={onClose} showDragHandle={false}>
      <EarlyUnstakeContent
        position={position}
        onClose={onClose}
        onConfirm={onConfirm}
        isMobile={true}
      />
    </MobileBottomSheet>
  );
}
