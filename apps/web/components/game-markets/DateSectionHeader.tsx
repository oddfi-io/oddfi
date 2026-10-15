"use client";

import { memo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDateLabel } from "@/lib/date-utils";

interface DateSectionHeaderProps {
  date: string; // "2026-03-26" or "live"
  today: string; // "2026-03-26"
  isLive?: boolean;
}

/**
 * Sticky date section header for timeline match list.
 * Formats label with i18n: "Today" / "Tomorrow" / "Fri, Mar 28" / "LIVE".
 */
export default memo(function DateSectionHeader({ date, today, isLive }: DateSectionHeaderProps) {
  const t = useTranslations("markets");
  const locale = useLocale();

  const label = isLive
    ? t("timelineLive")
    : formatDateLabel(date, today, t("timelineToday"), t("timelineTomorrow"), locale);

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 px-2 py-3 bg-primary/95 backdrop-blur-sm">
      {isLive && (
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fn-red opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-fn-red" />
        </span>
      )}
      <h3
        className={`text-[14px] font-bold leading-[20px] ${
          isLive ? "text-fn-red uppercase" : "text-primary"
        }`}
      >
        {label}
      </h3>
    </div>
  );
});
