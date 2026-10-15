// [TEMP:staking] Temporary — will be replaced when backend staking API is ready
"use client";

import { useTranslations } from "next-intl";
import { formatAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { formatOfi } from "./calc";
import type { StakeEstimate } from "./types";

interface EstimateCardProps {
  estimate: StakeEstimate | null;
  lockDays: number;
  multiplier: number;
}

export default function EstimateCard({ estimate, lockDays, multiplier }: EstimateCardProps) {
  const t = useTranslations("staking");

  // 无金额时不渲染
  if (!estimate) return null;

  const unlockDate = new Date(estimate.unlockDate).toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-[16px]">
      {/* 标题 */}
      <span className="text-[14px] text-secondary">{t("youWillEarn")}</span>

      {/* 2×2 grid 预估数据 */}
      <div className="grid grid-cols-2 gap-[12px]">
        {/* Est. APY */}
        <div className="flex flex-col justify-between flex-1 h-[64px] border border-divider-light rounded-8 px-[16px] py-[8px]">
          <span className="text-[12px] text-secondary leading-[18px]">{t("estApy")}</span>
          <span className="text-[16px] font-bold text-green leading-[24px]">
            {formatAmount(estimate.apy, 1)}%
          </span>
        </div>

        {/* Daily Earn */}
        <div className="flex flex-col justify-between flex-1 h-[64px] border border-divider-light rounded-8 px-[16px] py-[8px]">
          <span className="text-[12px] text-secondary leading-[18px]">{t("dailyEarn")}</span>
          <span className="text-[16px] font-bold text-primary leading-[24px]">
            {formatOfi(estimate.dailyEarn)} {PLATFORM_TOKEN_DISPLAY}
          </span>
        </div>

        {/* Period Total */}
        <div className="flex flex-col justify-between flex-1 h-[64px] border border-divider-light rounded-8 px-[16px] py-[8px]">
          <span className="text-[12px] text-secondary leading-[18px]">
            {lockDays}
            {t("daysShort")} Total
          </span>
          <span className="text-[16px] font-bold text-primary leading-[24px]">
            {formatOfi(estimate.totalEarn)} {PLATFORM_TOKEN_DISPLAY}
          </span>
        </div>

        {/* USD Value */}
        <div className="flex flex-col justify-between flex-1 h-[64px] border border-divider-light rounded-8 px-[16px] py-[8px]">
          <span className="text-[12px] text-secondary leading-[18px]">{t("inUsd")}</span>
          <span className="text-[16px] font-bold text-primary leading-[24px]">
            ${formatOfi(estimate.totalEarnUsd)}
          </span>
        </div>
      </div>

      {/* Unlock Date 行 */}
      <div className="flex items-center justify-between">
        <span className="text-[14px] text-tertiary">{t("unlockDate")}</span>
        <span className="text-[14px] text-primary">{unlockDate}</span>
      </div>

      {/* APY 公式说明 */}
      <p className="text-[14px] text-tertiary leading-[19px]">
        {t("apyFormula", { multiplier: `${multiplier}x` })}
      </p>
    </div>
  );
}
