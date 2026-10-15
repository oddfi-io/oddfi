"use client";

/**
 * Calendar 页头（DD-091 §3.1 + Figma `4379:88160` + `4379:87256`）。
 *
 * 包含：标题 + Stage Tabs + Filter pills（B5.2）+ Tz Toggle（B5.1）。
 */
import { useTranslations } from "next-intl";
import CalendarStageTabs from "./CalendarStageTabs";
import CalendarFilters from "./CalendarFilters";
import type { CalendarStage, CalendarStageId } from "@/types/calendar";

interface CalendarHeaderProps {
  title: string;
  stages: CalendarStage[];
  windowStart: string;
  windowEnd: string;
  onStageSelect?: (stage: CalendarStageId) => void;
  groups?: string[];
  selectedGroups?: string[];
  onGroupsChange?: (selected: string[]) => void;
}

export default function CalendarHeader({
  title,
  stages,
  windowStart,
  windowEnd,
  onStageSelect,
  groups = [],
  selectedGroups,
  onGroupsChange,
}: CalendarHeaderProps) {
  const t = useTranslations("calendarPage");
  return (
    <header className="flex flex-col gap-[16px] px-[16px] md:px-[24px] pt-[16px] md:pt-[24px]">
      <h1 className="font-orbitron text-[20px] leading-[24px] font-semibold text-primary">
        {title}
      </h1>
      {/* H5 下 stage tabs 单独行 + filter/tz 横向滚动 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-[12px] md:gap-[16px]">
        <div className="overflow-x-auto scrollbar-hide -mx-[16px] md:mx-0 px-[16px] md:px-0">
          <CalendarStageTabs stages={stages} onSelect={onStageSelect} />
        </div>
        <div className="flex items-center gap-[8px] shrink-0">
          <CalendarFilters
            windowStart={windowStart}
            windowEnd={windowEnd}
            options={groups.map((g) => ({ id: g, label: t("hover.groupLabel", { name: g }) }))}
            selected={selectedGroups}
            onSelectedChange={onGroupsChange}
          />
        </div>
      </div>
    </header>
  );
}
