"use client";

import { useTranslations } from "next-intl";
import { ReturnResultBadge } from "./StatusBadge";
import TeamAvatarPair from "@/components/common/TeamAvatarPair";
import type { ReturnRecord } from "./types";

interface ReturnCardProps {
  record: ReturnRecord;
}

export default function ReturnCard({ record: r }: ReturnCardProps) {
  const t = useTranslations("pools");

  return (
    <div className="bg-fill-card1 rounded-16 p-[16px] flex flex-col gap-[12px]">
      {/* 顶部：队徽 + 赛事名 + 日期 */}
      <div className="flex items-center gap-[12px]">
        <TeamAvatarPair homeTeamLogo={r.homeTeamLogo} awayTeamLogo={r.awayTeamLogo} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-primary font-medium leading-tight truncate">{r.match}</p>
          <p className="text-[12px] text-secondary mt-[2px]">{r.matchDate}</p>
        </div>
      </div>

      {/* 5 行 key-value */}
      <div className="flex flex-col gap-[8px]">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-secondary">{t("colResult")}</span>
          <ReturnResultBadge result={r.result} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-secondary">{t("colDate")}</span>
          <span className="text-[13px] text-primary">{r.date}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-secondary">{t("marginEarned")}</span>
          <span
            className={`text-[13px] ${r.marginEarned === "0 ODD" ? "text-primary" : "text-green"}`}
          >
            {r.marginEarned}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-secondary">{t("lossAbsorbed")}</span>
          <span
            className={`text-[13px] ${r.lossAbsorbed === "0 ODD" ? "text-primary" : "text-fn-red"}`}
          >
            {r.lossAbsorbed}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-secondary">{t("netPnl")}</span>
          <span
            className={`text-[13px] font-medium ${r.netPnlPositive ? "text-green" : "text-fn-red"}`}
          >
            {r.netPnl}
          </span>
        </div>
      </div>
    </div>
  );
}
