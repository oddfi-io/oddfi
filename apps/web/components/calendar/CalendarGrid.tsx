"use client";

/**
 * Calendar 网格主体（DD-091 §3.5(1) + §3.5(7)）。
 *
 * CSS Grid 派位 + 单实例共享 hover popover。
 */
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  COL_GAP,
  COL_WIDTH_PC,
  ROW_GAP,
  ROW_HEIGHT,
  TIME_AXIS_WIDTH,
  Y_TIMES_UTC,
} from "@/lib/calendar/constants";
import { CalendarTimeAxisColumn } from "./CalendarTimeAxis";
import CalendarMatchCard from "./CalendarMatchCard";
import CalendarMatchPair from "./CalendarMatchPair";
import CalendarHoverPopover, { type HoverPlacement } from "./CalendarHoverPopover";
import { groupFixturesByCell } from "@/lib/calendar/grid-layout";
import { getBrowserTimezone } from "@/lib/calendar/timezone";
import { buildStageOrdinalMap } from "@/lib/calendar/derivers";
import { useCalendarHoverIntent } from "@/hooks/useCalendarHoverIntent";
import { useCalendarStore, selectTzPref } from "@/stores/calendarStore";
import type { CalendarDate } from "@/types/calendar";
import type { SportmonksFixture } from "@/types/api";

interface CalendarGridProps {
  dates: CalendarDate[];
  fixtures: SportmonksFixture[];
  fixtureGroupMap?: Map<number, string>;
}

const CalendarGrid = forwardRef<HTMLDivElement, CalendarGridProps>(function CalendarGrid(
  { dates, fixtures, fixtureGroupMap },
  scrollRef
) {
  const tzPref = useCalendarStore(selectTzPref);
  const dateIsoList = useMemo(() => dates.map((d) => d.date_iso), [dates]);

  const grouped = useMemo(() => {
    const tz = tzPref === "UTC" ? "UTC" : getBrowserTimezone();
    return groupFixturesByCell(fixtures, tz, dateIsoList);
  }, [fixtures, tzPref, dateIsoList]);

  const ordinalMap = useMemo(() => buildStageOrdinalMap(fixtures), [fixtures]);

  // ─── Hover popover state（共享单实例） ─────────────────────────
  const hover = useCalendarHoverIntent<number>();
  const elMap = useRef(new Map<number, HTMLButtonElement>());
  const fixtureMap = useMemo(() => {
    const m = new Map<number, SportmonksFixture>();
    for (const f of fixtures) m.set(f.id, f);
    return m;
  }, [fixtures]);

  const setEl = (id: number) => (el: HTMLButtonElement | null) => {
    if (el) elMap.current.set(id, el);
    else elMap.current.delete(id);
  };

  // 计算 popover 位置（active 时）
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
    placement: HoverPlacement;
  } | null>(null);

  useEffect(() => {
    if (hover.activeId === null) {
      setPopoverPos(null);
      return;
    }
    const el = elMap.current.get(hover.activeId);
    if (!el) {
      setPopoverPos(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const POPOVER_HEIGHT = 200; // 估算
    const aboveSpace = rect.top;
    const placement: HoverPlacement = aboveSpace >= POPOVER_HEIGHT + 12 ? "above" : "below";
    const top = placement === "above" ? rect.top - POPOVER_HEIGHT - 8 : rect.bottom + 8;
    const left = rect.left + rect.width / 2;
    setPopoverPos({ top, left, placement });
  }, [hover.activeId]);

  const activeFixture = hover.activeId !== null ? (fixtureMap.get(hover.activeId) ?? null) : null;

  // ─── Pointer drag 水平拖动 ─────────────────────────────────────
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartLeft = useRef(0);

  if (dates.length === 0) {
    return (
      <div
        role="status"
        className="border border-divider rounded-12 bg-secondary px-[24px] py-[40px] text-center text-secondary text-[14px]"
      >
        No match days in selected range
      </div>
    );
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    scrollStartLeft.current = e.currentTarget.scrollLeft;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = "grabbing";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dx = dragStartX.current - e.clientX;
    e.currentTarget.scrollLeft = scrollStartLeft.current + dx;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    e.currentTarget.style.cursor = "";
  };

  return (
    <div
      ref={scrollRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="relative overflow-x-auto overflow-y-hidden [touch-action:pan-x_pan-y] overscroll-x-contain"
    >
      <div
        role="grid"
        aria-label="Match schedule grid"
        style={{
          display: "grid",
          gridTemplateColumns: `${TIME_AXIS_WIDTH}px repeat(${dates.length}, ${COL_WIDTH_PC}px)`,
          gridTemplateRows: `0px repeat(${Y_TIMES_UTC.length}, ${ROW_HEIGHT}px)`,
          rowGap: `${ROW_GAP}px`,
          columnGap: `${COL_GAP}px`,
          width: "fit-content",
        }}
      >
        {/* Column 1 全高背景条 — 覆盖 rowGap 透明间隙，防止 match 卡片透出 */}
        <div
          style={{ gridRow: `1 / span ${Y_TIMES_UTC.length + 1}`, gridColumn: 1 }}
          className="sticky left-0 z-10 bg-primary"
        />

        <CalendarTimeAxisColumn />

        {/* 网格背景 — 单元格无边线（按 Figma 主稿，整体非表格观感） */}

        {/* Match cards — 按 (gridRow, gridCol) 派位 */}
        {[...grouped.entries()].map(([key, list]) => {
          const [gridRow, gridCol] = key.split("-").map(Number);
          if (list.length === 1) {
            const f = list[0];
            return (
              <CalendarMatchCard
                key={f.id}
                fixture={f}
                ordinal={ordinalMap.get(f.id)}
                style={{ gridRow, gridColumn: gridCol }}
                cardRef={setEl(f.id)}
                hoverProps={hover.bindTrigger(f.id)}
                groupName={fixtureGroupMap?.get(f.id)}
              />
            );
          }
          if (list.length >= 2) {
            const [a, b] = [list[0], list[1]];
            return (
              <CalendarMatchPair
                key={key}
                fixtures={[a, b]}
                style={{ gridRow, gridColumn: gridCol }}
                slotBindings={[
                  { cardRef: setEl(a.id), hoverProps: hover.bindTrigger(a.id) },
                  { cardRef: setEl(b.id), hoverProps: hover.bindTrigger(b.id) },
                ]}
                groupNames={[fixtureGroupMap?.get(a.id), fixtureGroupMap?.get(b.id)]}
              />
            );
          }
          return null;
        })}
      </div>

      {/* Shared hover popover — 触屏设备 hover.isTouchDevice=true 时不渲染 */}
      {!hover.isTouchDevice && activeFixture && popoverPos && (
        <CalendarHoverPopover
          fixture={activeFixture}
          position={popoverPos}
          groupName={fixtureGroupMap?.get(activeFixture.id)}
          {...hover.bindPopover()}
        />
      )}
    </div>
  );
});

export default CalendarGrid;
