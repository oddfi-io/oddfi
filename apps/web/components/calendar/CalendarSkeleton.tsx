"use client";

import { Fragment } from "react";
import {
  COL_GAP,
  COL_WIDTH_PC,
  DATE_AXIS_HEIGHT,
  MATCH_CARD_HEIGHT,
  ROW_GAP,
  ROW_HEIGHT,
  TIME_AXIS_WIDTH,
} from "@/lib/calendar/constants";

const SKELETON_COLS = 6;
// 控制可视行数，避免骨架屏在 viewport 内溢出出现 y 轴滚动条
const SKELETON_ROWS = 8;

const STAGE_TAB_WIDTHS = [96, 88, 72, 96, 80];
const FILTER_WIDTHS = [80, 96, 40];

const Pulse = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`bg-white/10 animate-pulse ${className ?? ""}`} style={style} />
);

/** 单元格骨架 — 镜像 CalendarMatchCard：rounded-8 + border-l-4 + m-[4px] + 双行内容 */
function SkeletonMatchCard() {
  return (
    <div
      style={{ height: MATCH_CARD_HEIGHT }}
      className="m-[4px] rounded-8 border-l-4 border-white/10 bg-secondary flex flex-col justify-center gap-[8px] px-[16px]"
    >
      {/* Teams 行：flag + ARG / VS / PER + flag */}
      <div className="flex items-center justify-between gap-[8px]">
        <div className="flex items-center gap-[6px] min-w-0">
          <Pulse className="rounded-full shrink-0" style={{ width: 20, height: 20 }} />
          <Pulse className="rounded" style={{ width: 32, height: 14 }} />
        </div>
        <Pulse className="rounded shrink-0" style={{ width: 18, height: 12 }} />
        <div className="flex items-center gap-[6px] min-w-0 justify-end">
          <Pulse className="rounded" style={{ width: 32, height: 14 }} />
          <Pulse className="rounded-full shrink-0" style={{ width: 20, height: 20 }} />
        </div>
      </div>
      {/* 副标行：Stage · Mx */}
      <Pulse className="rounded" style={{ width: 84, height: 12 }} />
    </div>
  );
}

export default function CalendarSkeleton() {
  return (
    <div className="flex flex-col pb-[24px]">
      {/* ── 吸顶区（完全镜像真实 sticky 结构）── */}
      <div className="sticky top-[64px] lg:top-[100px] z-30 bg-primary flex flex-col gap-[16px] pb-[16px]">
        {/* H5 only: sport-type tab bar（Soccer / News / Calendar） */}
        <div className="lg:hidden px-[16px] border-b border-divider-secondary">
          <div className="flex items-center gap-[8px]">
            <Pulse className="rounded" style={{ height: 44, width: 64 }} />
            <Pulse className="rounded" style={{ height: 44, width: 52 }} />
            <Pulse className="rounded" style={{ height: 44, width: 76 }} />
          </div>
        </div>

        {/* CalendarHeader 占位 */}
        <header className="flex flex-col gap-[16px] px-[16px] md:px-[24px] pt-[16px] md:pt-[24px]">
          {/* 标题 */}
          <Pulse className="h-[24px] rounded" style={{ width: 220 }} />

          {/* stage tabs + filters 行 */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-[12px] md:gap-[16px]">
            <div className="overflow-x-hidden -mx-[16px] md:mx-0 px-[16px] md:px-0">
              <div className="flex items-center gap-[12px]">
                {STAGE_TAB_WIDTHS.map((w, i) => (
                  <Pulse
                    key={i}
                    className="h-[40px] rounded-full shrink-0"
                    style={{ width: w, minHeight: 44 }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-[8px] shrink-0">
              {FILTER_WIDTHS.map((w, i) => (
                <Pulse key={i} className="h-[40px] rounded-[12px]" style={{ width: w }} />
              ))}
            </div>
          </div>
        </header>

        {/* SectionBanner 占位 */}
        <div className="px-[24px]">
          <Pulse className="h-[40px] rounded-8" />
        </div>

        {/* CalendarGridHeader 占位（UTC corner + 日期 pill 行，镜像真实 grid） */}
        <div className="px-[24px]">
          <div className="overflow-x-hidden" style={{ scrollbarWidth: "none" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `${TIME_AXIS_WIDTH}px repeat(${SKELETON_COLS}, ${COL_WIDTH_PC}px)`,
                gridTemplateRows: `${DATE_AXIS_HEIGHT}px`,
                columnGap: COL_GAP,
                paddingBottom: 12,
                width: "fit-content",
              }}
            >
              {/* corner 占位（镜像 CalendarTimeAxisCorner：bg-secondary + rounded-l-8） */}
              <div className="bg-secondary rounded-l-8 flex items-center justify-center">
                <Pulse className="rounded" style={{ width: 28, height: 14 }} />
              </div>
              {/* 日期 pill 占位（镜像 CalendarDateAxis：每列 bg-secondary rounded-8 居中文本） */}
              {Array.from({ length: SKELETON_COLS }).map((_, i) => (
                <div key={i} className="bg-secondary rounded-8 flex items-center justify-center">
                  <Pulse className="rounded" style={{ width: 88, height: 14 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 滚动区：时间轴列 + 比赛卡片网格（镜像 CalendarGrid） ── */}
      <div className="px-[24px]">
        <div className="overflow-x-hidden">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${TIME_AXIS_WIDTH}px repeat(${SKELETON_COLS}, ${COL_WIDTH_PC}px)`,
              gridTemplateRows: `repeat(${SKELETON_ROWS}, ${ROW_HEIGHT}px)`,
              rowGap: ROW_GAP,
              columnGap: COL_GAP,
              width: "fit-content",
            }}
          >
            {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
              <Fragment key={row}>
                {/* 时间标签格（镜像 CalendarTimeAxisColumn：bg-secondary rounded-l-8 + 居中 Pulse） */}
                <div className="bg-secondary rounded-l-8 flex items-center justify-center">
                  <Pulse className="rounded" style={{ width: 32, height: 14 }} />
                </div>
                {/* 跳行展示小卡：偶数行渲染卡，奇数行用空格占位保持 grid 对齐 */}
                {Array.from({ length: SKELETON_COLS }).map((_, col) =>
                  row % 2 === 0 ? <SkeletonMatchCard key={col} /> : <div key={col} />
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
