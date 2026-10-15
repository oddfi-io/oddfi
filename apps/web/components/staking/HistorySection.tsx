// [TEMP:staking] Temporary — will be replaced when backend staking API is ready
"use client";

import { useTranslations } from "next-intl";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import type { HistoryRecord } from "./types";
import { formatOfi } from "./calc";

interface HistorySectionProps {
  records: HistoryRecord[];
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

export default function HistorySection({ records }: HistorySectionProps) {
  const t = useTranslations("staking");

  if (records.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-secondary text-[14px]">{t("noHistory")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px]">
      {records.map((r) => (
        <div key={r.id} className="border border-divider-light rounded-8 px-[16px] py-[20px]">
          <div className="flex items-center justify-between">
            {/* Left: Title + date/period */}
            <div className="flex flex-col gap-[4px]">
              <span className="text-[14px] md:text-[16px] font-bold md:font-medium text-primary leading-[19px] md:leading-[24px]">
                {r.action === "stake"
                  ? t("tabStake")
                  : r.action === "early_unstake"
                    ? t("actionEarlyUnstake")
                    : t("tabUnstake")}{" "}
                {formatOfi(r.amount)} {PLATFORM_TOKEN_DISPLAY}
              </span>
              <div className="flex items-center gap-[8px]">
                <span className="text-[12px] text-secondary leading-[18px]">
                  {formatDateTime(r.date)}
                </span>
                {/* @figma-hardcoded: #37393a divider-primary vertical separator — pending design token */}
                <div className="w-px h-[10px] bg-[#37393a]" />
                <span className="text-[12px] text-secondary leading-[18px]">
                  {r.lockDays}
                  {t("daysShort")}·{r.multiplier}x
                </span>
              </div>
            </div>
            {/* Right: Earned (normal unstake) / Forfeited tag (early_unstake) */}
            {r.action === "early_unstake" ? (
              <div className="flex flex-col gap-[4px] items-end">
                <span className="text-[12px] text-secondary leading-[18px]">
                  {t("earnedLabel")}
                </span>
                <span className="text-[12px] md:text-[14px] font-medium text-secondary leading-[18px] md:leading-[19px]">
                  {t("historyEarlyForfeited")}
                </span>
              </div>
            ) : (
              r.reward && (
                <div className="flex flex-col gap-[4px] items-end">
                  <span className="text-[12px] text-secondary leading-[18px]">
                    {t("earnedLabel")}
                  </span>
                  <span className="text-[14px] md:text-[16px] font-bold text-green leading-[19px] md:leading-[24px]">
                    +{formatOfi(r.reward)} {PLATFORM_TOKEN_DISPLAY}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
