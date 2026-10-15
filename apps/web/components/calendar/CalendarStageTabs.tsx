"use client";

/**
 * Stage Tabs（Figma `4379:88209`）。
 *
 * 7 段单选切换。点击 → 设 pinnedStage（同步 activeStage） + 触发外部 onSelect 回调。
 * 视觉复用 markets 页 `Chip`（today/tomorrow/all/live 同款胶囊型），保持站内一致。
 */
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/game-markets/LeagueChips";
import { STAGE_ORDER } from "@/lib/calendar/constants";
import { useCalendarStore, selectActiveStage } from "@/stores/calendarStore";
import type { CalendarStage, CalendarStageId } from "@/types/calendar";

interface CalendarStageTabsProps {
  /** 实际有数据的 stages（数据驱动；少于 7 段时缺失部分不渲染） */
  stages: CalendarStage[];
  /** 用户点击 tab 的回调，B3 接入滚动定位 + cascade walkthrough */
  onSelect?: (stage: CalendarStageId) => void;
}

export default function CalendarStageTabs({ stages, onSelect }: CalendarStageTabsProps) {
  const t = useTranslations("calendarPage");
  const activeStage = useCalendarStore(selectActiveStage);
  const setPinnedStage = useCalendarStore((s) => s.setPinnedStage);
  const tabRefs = useRef<Map<CalendarStageId, HTMLButtonElement>>(new Map());

  // 按固定 7 段顺序 + 过滤实际存在的 stages
  const orderedStages = STAGE_ORDER.map((id) => stages.find((s) => s.stage_id === id)).filter(
    (s): s is CalendarStage => s !== undefined
  );

  const activate = (stage_id: CalendarStageId) => {
    setPinnedStage(stage_id);
    onSelect?.(stage_id);
    tabRefs.current.get(stage_id)?.focus();
  };

  // a11y 键盘导航：Arrow Left/Right 切上下一段；Home/End 跳首尾
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
    let nextIdx = -1;
    if (e.key === "ArrowRight") nextIdx = (currentIdx + 1) % orderedStages.length;
    else if (e.key === "ArrowLeft")
      nextIdx = (currentIdx - 1 + orderedStages.length) % orderedStages.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = orderedStages.length - 1;
    if (nextIdx >= 0) {
      e.preventDefault();
      activate(orderedStages[nextIdx].stage_id);
    }
  };

  return (
    <div role="tablist" aria-label="Tournament stages" className="flex items-center gap-[12px]">
      {orderedStages.map((stage, idx) => {
        const isActive = stage.stage_id === activeStage;
        return (
          <Chip
            key={stage.stage_id}
            ref={(el) => {
              if (el) tabRefs.current.set(stage.stage_id, el);
              else tabRefs.current.delete(stage.stage_id);
            }}
            label={t(`stages.${stage.stage_id}`)}
            isActive={isActive}
            onClick={() => activate(stage.stage_id)}
            role="tab"
            tabIndex={isActive ? 0 : -1}
            aria-selected={isActive}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          />
        );
      })}
    </div>
  );
}
