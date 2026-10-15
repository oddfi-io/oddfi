"use client";

/**
 * Section Banner（Figma `4379:88336` + `4384:88425`）。
 *
 * 全量渲染所有 stage 横幅（不只是 active stage），各自按列起点定位，
 * 随 scrollLeft 同步平移。左 3px 实色边 + 半透明背景 + Stage 名 Bold +
 * 日期范围 Medium 灰。色板按 stage 切换。
 */
import { useLocale, useTranslations } from "next-intl";
import { COL_GAP, COL_WIDTH_PC, TIME_AXIS_WIDTH, STAGE_PALETTE } from "@/lib/calendar/constants";
import type { CalendarDate, CalendarStage } from "@/types/calendar";

interface CalendarSectionBannerProps {
  stages: CalendarStage[];
  dates: CalendarDate[];
  scrollLeft: number;
}

function formatShortDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

export default function CalendarSectionBanner({
  stages,
  dates,
  scrollLeft,
}: CalendarSectionBannerProps) {
  const t = useTranslations("calendarPage");
  const locale = useLocale();

  if (stages.length === 0 || dates.length === 0) return null;

  const lastDateIso = dates[dates.length - 1].date_iso;

  function formatRange(stage: CalendarStage): string {
    const unit = stage.days === 1 ? t("sectionBanner.day") : t("sectionBanner.days");
    if (stage.date_start === stage.date_end) {
      return `${formatShortDate(stage.date_start, locale)} · ${stage.days} ${unit}`;
    }
    return `${formatShortDate(stage.date_start, locale)} – ${formatShortDate(stage.date_end, locale)} · ${stage.days} ${unit}`;
  }

  function formatTitle(stage: CalendarStage): string {
    return stage.stage_id === "group"
      ? t("sectionBanner.groupMatches")
      : t(`stages.${stage.stage_id}`);
  }

  return (
    <div className="relative h-[40px] overflow-hidden">
      {stages.map((stage, stageIdx) => {
        // 跳过完全不在可见日期范围内的 stage
        if (stage.date_end < dates[0].date_iso || stage.date_start > lastDateIso) return null;

        const palette = STAGE_PALETTE[stage.stage_id];
        const colIndex = dates.findIndex((d) => d.date_iso === stage.date_start);
        const colStride = COL_WIDTH_PC + COL_GAP;
        const bannerX = TIME_AXIS_WIDTH + COL_GAP + Math.max(0, colIndex) * colStride - scrollLeft;

        // 宽度按 match day 列数计算（而非 stage.days 日历天数），
        // 正好延伸到下一个 stage 的起点列，保证相邻 banner 零重叠零间隙。
        const nextStage = stages[stageIdx + 1];
        let endColIndex: number;
        if (nextStage) {
          const nextStartCol = dates.findIndex((d) => d.date_iso === nextStage.date_start);
          endColIndex = nextStartCol >= 0 ? nextStartCol - 1 : dates.length - 1;
        } else {
          endColIndex = dates.length - 1;
        }
        const colSpan = Math.max(1, endColIndex - Math.max(0, colIndex) + 1);
        const bannerWidth = colSpan * colStride;

        return (
          <div
            key={stage.stage_id}
            role="presentation"
            aria-hidden
            style={{
              transform: `translateX(${bannerX}px)`,
              width: bannerWidth,
              borderLeftColor: palette.hex,
              backgroundColor: palette.bgRgba,
            }}
            className="absolute top-0 h-[40px] flex items-center gap-[10px] rounded-8 border-l-[3px] pl-[20px] pr-[16px] will-change-transform"
          >
            <span className="text-[14px] leading-[19px] font-semibold text-primary whitespace-nowrap">
              {formatTitle(stage)}
            </span>
            <span className="text-[12px] leading-[18px] font-medium text-secondary truncate">
              {formatRange(stage)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
