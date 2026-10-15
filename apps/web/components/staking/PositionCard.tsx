// [TEMP:staking] Temporary — will be replaced when backend staking API is ready
"use client";

import { useTranslations } from "next-intl";
import { SpinnerIcon } from "@phosphor-icons/react";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { useTxLockStore } from "@/stores/txLockStore";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";
import StakeTag from "./StakeTag";
import { formatOfi } from "./calc";
import type { StakingPosition } from "./types";

interface PositionCardProps {
  position: StakingPosition;
  onUnstake: () => void;
  /** 当前正在 unstake 的 positionId（用于 spinner 仅显示在被点击的那张卡） */
  pendingUnstakeId?: string;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export default function PositionCard({ position, onUnstake, pendingUnstakeId }: PositionCardProps) {
  const t = useTranslations("staking");
  const isLocked = useTxLockStore((s) => s.isLocked);
  const isMyTx = pendingUnstakeId === position.id;

  // Withdrawn positions are filtered out of active list by UnstakeTab; defensive guard.
  if (position.status === "withdrawn") return null;

  const actionButton = (fullWidth: boolean) => {
    // active 态前端不开放早赎入口；按钮位置留空（Figma 设计稿未覆盖此区域）
    if (position.status !== "ready") return null;

    return (
      <button
        type="button"
        onClick={IS_SUBSCRIPTION_MODE ? undefined : onUnstake}
        disabled={IS_SUBSCRIPTION_MODE || isLocked}
        className={[
          "h-[32px] rounded-8 bg-fill-card2 shadow-xs font-medium text-[12px] text-primary",
          "flex items-center justify-center gap-[6px]",
          IS_SUBSCRIPTION_MODE || (isLocked && !isMyTx) ? "opacity-50 cursor-not-allowed" : "",
          fullWidth ? "w-full" : "px-[16px]",
        ].join(" ")}
        style={{ touchAction: "manipulation" }}
      >
        {isMyTx && <SpinnerIcon size={14} weight="bold" className="animate-spin" />}
        {isMyTx ? t("processing") : t("unstakeBtn")}
      </button>
    );
  };

  return (
    <div className="border border-divider-light rounded-8 relative">
      {/* Right-top period tag */}
      <span className="absolute top-0 right-0">
        <StakeTag corner>
          {position.lockDays}
          {t("daysShort")} · {position.multiplier}x
        </StakeTag>
      </span>

      <div className="flex flex-col gap-[16px] px-[16px] py-[20px]">
        {/* Row 1: Amount + Status badge */}
        <div>
          <div className="flex items-center gap-[8px]">
            <span className="text-[18px] font-bold text-primary leading-[26px]">
              {formatOfi(position.amount)} {PLATFORM_TOKEN_DISPLAY}
            </span>
            <StakeTag variant={position.status === "ready" ? "green" : "orange"}>
              {position.status === "ready" ? t("statusReady") : t("statusActive")}
            </StakeTag>
          </div>
        </div>

        {/* Divider 1 */}
        <div className="border-t border-divider-light" />

        {/* Staking amount / Earned */}
        <div className="flex items-start">
          <div className="flex-1 flex flex-col gap-[4px]">
            <span className="text-[12px] text-secondary leading-[18px]">{t("stakingAmount")}</span>
            <span className="text-[14px] font-bold text-primary leading-[19px]">
              {formatOfi(position.amount)} {PLATFORM_TOKEN_DISPLAY}
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-[4px] items-end md:items-start min-w-0">
            <span className="text-[12px] text-secondary leading-[18px]">{t("earnedLabel")}</span>
            <span className="text-[14px] font-bold text-green leading-[19px] text-right md:text-left break-words w-full">
              +{formatOfi(position.earned)} {PLATFORM_TOKEN_DISPLAY}
            </span>
          </div>
        </div>

        {/* Divider 2 */}
        <div className="border-t border-divider-light" />

        {/* PC: Dates left + Button right */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex flex-col gap-[4px]">
            <span className="text-[12px] text-secondary leading-[18px]">
              {t("stakingDate")}: {formatDateTime(position.stakedAt)}
            </span>
            <span className="text-[12px] text-secondary leading-[18px]">
              {t("unlockedOn")}: {formatDateTime(position.unlockAt)}
            </span>
          </div>
          {actionButton(false)}
        </div>

        {/* H5: Button full-width, then dates */}
        <div className="flex md:hidden flex-col gap-[10px]">
          {actionButton(true)}
          <div className="flex flex-col gap-[4px]">
            <span className="text-[12px] text-secondary leading-[18px]">
              {t("stakingDate")}: {formatDateTime(position.stakedAt)}
            </span>
            <span className="text-[12px] text-secondary leading-[18px]">
              {t("unlockedOn")}: {formatDateTime(position.unlockAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
