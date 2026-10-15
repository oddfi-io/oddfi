"use client";

import { useTranslations } from "next-intl";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";

export default function ReturnStatsCards() {
  const t = useTranslations("pools");

  const stats = [
    {
      label: t("totalMarginEarned"),
      value: `+7,590 ${PLATFORM_TOKEN_DISPLAY}`,
      valueClass: "text-green",
    },
    {
      label: t("totalLossAbsorbed"),
      value: `-4,650 ${PLATFORM_TOKEN_DISPLAY}`,
      valueClass: "text-fn-red",
    },
    {
      label: t("readyToWithdraw"),
      value: `+2,940 ${PLATFORM_TOKEN_DISPLAY}`,
      valueClass: "text-green",
    },
    { label: t("houseWinRate"), value: "62.5%", valueClass: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[12px] lg:gap-[16px] lg:mb-[24px]">
      {stats.map((s) => (
        <div key={s.label} className="bg-fill-card1 rounded-16 p-[16px]">
          <p className="text-secondary text-[12px] mb-[8px]">{s.label}</p>
          <p className={`text-[18px] font-bold ${s.valueClass}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
