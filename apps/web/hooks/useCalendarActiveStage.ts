"use client";

/**
 * Stage 滚动定位 + Pin 锁。
 *
 * 行为：
 *   - Stage tab 点击：直接 scrollTo 目标段 + setPinnedStage 锁定 active
 *   - 用户主动 wheel / touchstart / pointerdown：releasePin，scroll listener
 *     重新接管 active 派生
 *   - scroll listener 监听 grid scrollLeft，以视口**右边缘**触达 stage 首列
 *     为阈值激活该 stage，覆盖 sf/third/final 等末尾短段
 *
 * 设计变更（基于交互反馈）：
 *   - 历史方案曾包含 cascade walkthrough（短段段前累计前置段，多段串联滚动 +
 *     dwell），但实测体感是反直觉的卡顿 — 用户点 R16 不期望先经过 R32 停顿
 *     800ms。现统一为单段直滚，所有点击都丝滑 ~SCROLL_MS（浏览器原生 smooth）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { COL_WIDTH_PC, TIME_AXIS_WIDTH, STAGE_ORDER } from "@/lib/calendar/constants";
import { useCalendarStore } from "@/stores/calendarStore";
import type { CalendarDate, CalendarStage, CalendarStageId } from "@/types/calendar";

export interface UseCalendarActiveStageReturn {
  gridScrollRef: React.RefObject<HTMLDivElement | null>;
  onStageSelect: (stageId: CalendarStageId) => void;
  scrollLeft: number;
}

export function useCalendarActiveStage(
  stages: CalendarStage[],
  dates: CalendarDate[]
): UseCalendarActiveStageReturn {
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const setPinnedStage = useCalendarStore((s) => s.setPinnedStage);
  const setActiveStage = useCalendarStore((s) => s.setActiveStage);
  const releasePin = useCalendarStore((s) => s.releasePin);
  const [scrollLeft, setScrollLeft] = useState(0);

  const scrollToStage = useCallback(
    (stageId: CalendarStageId) => {
      const el = gridScrollRef.current;
      if (!el) return;
      const stage = stages.find((s) => s.stage_id === stageId);
      if (!stage) return;
      const colIndex = dates.findIndex((d) => d.date_iso === stage.date_start);
      if (colIndex < 0) return;
      el.scrollTo({ left: colIndex * COL_WIDTH_PC, behavior: "smooth" });
    },
    [stages, dates]
  );

  const onStageSelect = useCallback(
    (stageId: CalendarStageId) => {
      setPinnedStage(stageId);
      scrollToStage(stageId);
    },
    [setPinnedStage, scrollToStage]
  );

  // ─── Pin release：用户主动滚动 → releasePin ────────
  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;

    const handler = () => releasePin();

    el.addEventListener("wheel", handler, { passive: true });
    el.addEventListener("touchstart", handler, { passive: true });
    el.addEventListener("pointerdown", handler);

    return () => {
      el.removeEventListener("wheel", handler);
      el.removeEventListener("touchstart", handler);
      el.removeEventListener("pointerdown", handler);
    };
  }, [releasePin]);

  // ─── Scroll listener: 视口右边缘触达 stage 首列 → 激活该 stage ───
  //
  // 以视口右边缘（而非中点）作为判据：
  //   rightEdgeCol = floor((scrollLeft + clientWidth - TIME_AXIS_WIDTH) / COL_WIDTH_PC)
  //
  // 遍历按时间顺序排列的 stages，找到右边缘已触达首列的最后一个 stage 即为当前 active。
  // 这样 sf / third / final 等 1–2 day 的短段只需右边缘碰到首列即切换，无需定时器 hack。
  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;

    // 按赛程时间顺序排列，保证遍历时后覆盖前，得到"最右已触达"的 stage
    const sortedStages = [...stages].sort(
      (a, b) => STAGE_ORDER.indexOf(a.stage_id) - STAGE_ORDER.indexOf(b.stage_id)
    );

    const handler = () => {
      const sl = el.scrollLeft;
      setScrollLeft(sl);

      // 视口右边缘对应的内容列索引（减去固定时间轴列宽）
      const rightEdgeOffset = sl + el.clientWidth - TIME_AXIS_WIDTH;
      const rightEdgeCol = Math.floor(rightEdgeOffset / COL_WIDTH_PC);

      // 找到右边缘已越过其首列的最右 stage
      let nextActive: CalendarStageId | null = null;
      for (const stage of sortedStages) {
        const colIdx = dates.findIndex((d) => d.date_iso === stage.date_start);
        if (colIdx >= 0 && colIdx <= rightEdgeCol) {
          nextActive = stage.stage_id;
        }
      }
      if (nextActive) setActiveStage(nextActive);
    };

    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [dates, stages, setActiveStage]);

  return { gridScrollRef, onStageSelect, scrollLeft };
}
