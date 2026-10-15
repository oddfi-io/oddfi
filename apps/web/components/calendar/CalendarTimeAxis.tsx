"use client";

/**
 * Y 轴时间标签 + 左上角 corner cell（Figma `4402:147482`）。
 *
 * 设计：作为 CSS Grid 子项渲染（emits Fragment），由 CalendarGrid 父组件统一布局。
 * - corner cell：gridRow=1, gridCol=1，sticky-both，**兼任时区切换 toggle**（点击 UTC ↔ Local）
 * - 14 时段：gridRow=2..15, gridCol=1, sticky-left
 *
 * 时区切换由 calendarStore.tzPref 驱动，buildTimeAxis 用 IANA 时区平移。
 */
import { useMemo } from "react";
import { buildTimeAxis, getBrowserTimezone } from "@/lib/calendar/timezone";
import { useCalendarTimezone } from "@/hooks/useCalendarTimezone";

/** 左上角 UTC 切换 corner（在 CalendarGridHeader 中使用） */
export function CalendarTimeAxisCorner() {
  const { tzPref, toggleTz } = useCalendarTimezone();
  const isLocal = tzPref === "local";
  const tzLabel = isLocal ? "Local" : "UTC";
  const browserTz = isLocal ? getBrowserTimezone() : "UTC";

  return (
    <div
      style={{ gridRow: 1, gridColumn: 1 }}
      className="sticky left-0 z-30 bg-primary flex items-center justify-center"
    >
      <button
        type="button"
        onClick={toggleTz}
        aria-pressed={isLocal}
        aria-label={`Toggle time zone, current: ${browserTz}`}
        className="w-full h-full bg-secondary rounded-l-8 flex items-center justify-center px-[16px] py-[8px] text-[14px] leading-[19px] font-medium text-secondary hover:text-primary transition-colors"
      >
        {tzLabel}
      </button>
    </div>
  );
}

/** 14 时段时间标签列（在 CalendarGrid body 中使用） */
export function CalendarTimeAxisColumn() {
  const { tzPref } = useCalendarTimezone();
  const cells = useMemo(() => {
    const tz = tzPref === "UTC" ? "UTC" : getBrowserTimezone();
    return buildTimeAxis(tz);
  }, [tzPref]);

  return (
    <>
      {cells.map((cell, idx) => (
        <div
          key={`${cell.hour}-${idx}`}
          style={{ gridRow: idx + 2, gridColumn: 1 }}
          className="sticky left-0 z-20 bg-primary flex items-stretch"
        >
          <div className="flex-1 bg-secondary rounded-l-8 flex items-center justify-center px-[16px] py-[10px] text-[14px] leading-[19px] font-medium text-secondary">
            {cell.label}
          </div>
        </div>
      ))}
    </>
  );
}

/** @deprecated 使用具名导出 CalendarTimeAxisCorner / CalendarTimeAxisColumn */
export default function CalendarTimeAxis() {
  const { tzPref, toggleTz } = useCalendarTimezone();

  const cells = useMemo(() => {
    const tz = tzPref === "UTC" ? "UTC" : getBrowserTimezone();
    return buildTimeAxis(tz);
  }, [tzPref]);

  const isLocal = tzPref === "local";
  const tzLabel = isLocal ? "Local" : "UTC";
  const browserTz = isLocal ? getBrowserTimezone() : "UTC";

  return (
    <>
      <div
        style={{ gridRow: 1, gridColumn: 1 }}
        className="sticky top-0 left-0 z-30 bg-primary flex items-center justify-center"
      >
        <button
          type="button"
          onClick={toggleTz}
          aria-pressed={isLocal}
          aria-label={`Toggle time zone, current: ${browserTz}`}
          className="w-full h-full bg-secondary rounded-l-8 flex items-center justify-center px-[16px] py-[8px] text-[14px] leading-[19px] font-medium text-secondary hover:text-primary transition-colors"
        >
          {tzLabel}
        </button>
      </div>
      {cells.map((cell, idx) => (
        <div
          key={`${cell.hour}-${idx}`}
          style={{ gridRow: idx + 2, gridColumn: 1 }}
          className="sticky left-0 z-20 bg-primary flex items-stretch"
        >
          <div className="flex-1 bg-secondary rounded-l-8 flex items-center justify-center px-[16px] py-[10px] text-[14px] leading-[19px] font-medium text-secondary">
            {cell.label}
          </div>
        </div>
      ))}
    </>
  );
}
