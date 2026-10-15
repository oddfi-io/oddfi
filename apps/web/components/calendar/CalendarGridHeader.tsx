"use client";

import { forwardRef } from "react";
import { COL_GAP, COL_WIDTH_PC, DATE_AXIS_HEIGHT, TIME_AXIS_WIDTH } from "@/lib/calendar/constants";
import { CalendarTimeAxisCorner } from "./CalendarTimeAxis";
import CalendarDateAxis from "./CalendarDateAxis";
import type { CalendarDate } from "@/types/calendar";

interface CalendarGridHeaderProps {
  dates: CalendarDate[];
}

const CalendarGridHeader = forwardRef<HTMLDivElement, CalendarGridHeaderProps>(
  function CalendarGridHeader({ dates }, ref) {
    if (dates.length === 0) return null;
    return (
      <div
        ref={ref}
        className="overflow-x-auto overflow-y-hidden scrollbar-hide pointer-events-none select-none"
        style={{ scrollbarWidth: "none", touchAction: "none" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${TIME_AXIS_WIDTH}px repeat(${dates.length}, ${COL_WIDTH_PC}px)`,
            gridTemplateRows: `${DATE_AXIS_HEIGHT}px`,
            columnGap: `${COL_GAP}px`,
            paddingBottom: 12,
            width: "fit-content",
          }}
        >
          <CalendarTimeAxisCorner />
          <CalendarDateAxis dates={dates} />
        </div>
      </div>
    );
  }
);

export default CalendarGridHeader;
