// [TEMP:staking] Temporary — will be replaced when backend staking API is ready
"use client";

import { useTranslations } from "next-intl";
import type { NetworkStats } from "./types";
import { formatOfi } from "./calc";

interface NetworkStatsBarProps {
  stats: NetworkStats;
}

export default function NetworkStatsBar({ stats }: NetworkStatsBarProps) {
  const t = useTranslations("staking");
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mb-6 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-secondary">{t("totalStaked")}</span>
        <span className="text-primary font-medium">{formatOfi(stats.totalStaked)} OFI</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-secondary">{t("rewardPool")}</span>
        <span className="text-green font-medium">{stats.rewardPool} OFI</span>
      </div>
    </div>
  );
}
