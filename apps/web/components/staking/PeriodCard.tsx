// [TEMP:staking] Temporary — will be replaced when backend staking API is ready
"use client";

import { useTranslations } from "next-intl";
import type { StakingTier } from "./types";
import { formatAmount } from "@/lib/decimal";
import StakeTag from "./StakeTag";

interface PeriodCardProps {
  tier: StakingTier;
  apy: string;
  selected: boolean;
  onSelect: () => void;
}

export default function PeriodCard({ tier, apy, selected, onSelect }: PeriodCardProps) {
  const t = useTranslations("staking");

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ touchAction: "manipulation" }}
      className={[
        "relative rounded-8 transition-all overflow-hidden",
        "flex flex-col gap-[6px] items-start justify-center",
        // H5: pb-12 px-12; PC: pb-16 px-16
        "pt-[20px] pb-[12px] px-[12px] md:pb-[16px] md:px-[16px]",
        selected
          ? "bg-fill-card2 border border-dt-hover"
          : "bg-fill-card2 border border-transparent",
      ].join(" ")}
    >
      {/* 锁定期天数（DD-149：合约真值，单位天） */}
      <span className="text-[14px] font-medium text-primary leading-[19px]">
        {tier.lockDays} {t("days")}
      </span>

      {/* APR 区域：H5 横排 items-end，PC 竖排 flex-col */}
      <div className="flex items-end md:flex-col md:gap-[2px] md:items-start">
        <span
          className={`text-[18px] font-bold leading-[26px] ${
            selected ? "text-primary" : "text-green"
          }`}
        >
          {formatAmount(apy, 1)}%
        </span>
        <span className="text-[10px] md:text-[11px] text-secondary leading-[14px] md:leading-[16px] w-[46px] text-center md:text-left">
          {t("estApy")}
        </span>
      </div>

      {/* 右上角倍率 tag */}
      <span className="absolute top-0 right-0 flex">
        <StakeTag corner>{tier.label}</StakeTag>
      </span>
    </button>
  );
}
