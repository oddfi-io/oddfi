"use client";

/**
 * X 轴日期标签（DD-091 §3.5(2)）。
 *
 * 设计：作为 CSS Grid 子项渲染（emits Fragment），由 CalendarGrid 父组件统一布局。
 * 35 个 match days 列头：gridRow=1, gridCol=2..36, sticky-top。
 */
import { useLocale } from "next-intl";
import type { CalendarDate } from "@/types/calendar";

interface CalendarDateAxisProps {
  dates: CalendarDate[];
}

function formatDateLabel(iso: string, locale: string): string {
  // 输出形如 "Thu, Jun 11"
  const d = new Date(`${iso}T00:00:00Z`);
  const weekday = d.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
  const month = d.toLocaleDateString(locale, { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `${weekday}, ${month} ${day}`;
}

export default function CalendarDateAxis({ dates }: CalendarDateAxisProps) {
  const locale = useLocale();
  return (
    <>
      {/* Date pill 列头（Figma `4379:88291`）：每列居中独立 pill，bg-secondary 四角圆 8 */}
      {dates.map((d, idx) => (
        <div
          key={d.date_iso}
          style={{ gridRow: 1, gridColumn: idx + 2 }}
          className="bg-primary flex items-center justify-center"
        >
          <div className="bg-secondary rounded-8 px-[10px] py-[8px] text-[14px] leading-[19px] font-medium text-secondary whitespace-nowrap w-full text-center">
            {formatDateLabel(d.date_iso, locale)}
          </div>
        </div>
      ))}
    </>
  );
}
