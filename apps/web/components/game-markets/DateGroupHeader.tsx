"use client";

import { memo } from "react";
import { useLocale, useTranslations } from "next-intl";
import CaretDownIcon from "@/components/icons/CaretDownIcon";
import { formatDateLabel } from "@/lib/date-utils";

interface DateGroupHeaderProps {
  /** 日期分组的本地运营日 key；非日期分组（传 label）可省略 */
  date?: string;
  today?: string;
  matchCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  /** 非日期分组（如「测试」组）的组头文案；提供时直接使用，跳过按日期格式化 */
  label?: string;
}

function DateGroupHeader({
  date,
  today,
  matchCount,
  isCollapsed,
  onToggle,
  label: labelOverride,
}: DateGroupHeaderProps) {
  const t = useTranslations("markets");
  const locale = useLocale();
  // 有 label（非日期分组）直接用；否则按日期格式化（date/today 由日期分组调用方保证存在）
  const label =
    labelOverride ??
    (date && today
      ? formatDateLabel(date, today, t("timelineToday"), t("timelineTomorrow"), locale)
      : "");

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!isCollapsed}
      style={{ touchAction: "manipulation" }}
      className={`flex w-full min-h-[44px] items-center justify-between gap-2 rounded-8 px-2 text-left transition-colors hover:bg-tertiary active:bg-tertiary ${
        isCollapsed ? "bg-secondary" : ""
      }`}
    >
      <span className="text-[14px] leading-[19px] font-medium text-primary">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {isCollapsed && (
          <span className="flex h-[22px] w-[30px] flex-col items-center justify-center gap-[10px] rounded-full bg-tertiary px-2 text-[12px] leading-[18px] font-medium text-primary">
            {matchCount}
          </span>
        )}
        <CaretDownIcon
          size={16}
          className={`shrink-0 text-primary transition-transform ${
            isCollapsed ? "" : "-scale-y-100"
          }`}
        />
      </span>
    </button>
  );
}

export default memo(DateGroupHeader);
