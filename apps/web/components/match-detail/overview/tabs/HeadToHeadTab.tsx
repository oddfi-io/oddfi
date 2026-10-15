"use client";

/**
 * HeadToHeadTab — Figma 节点 5107:183016 (容器) + 5107:183017 (sub-header)
 * DD-104 Batch 4：接入 useMatchDetailH2H 真实接口。
 *
 * 顶部 sub-header（22px 高，底部 12% 白色边框）：
 *   - 左侧：HEAD TO HEAD（10px uppercase font-medium #e0e0e0）
 *   - 右侧：< 1/3 > paginator（10px Regular #e0e0e0）
 *
 * 内容区：3 张 H2H 卡片轮播
 *   1/3 → WinProb + Previous Meetings
 *   2/3 → Average Goals
 *   3/3 → Form
 */

import { useState } from "react";
import {
  CaretLeftIcon,
  CaretRightIcon,
  ArrowsClockwiseIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMatchDetailH2H } from "@/hooks/useMatchDetailH2H";
import type { WinProbability, H2HSummary } from "@/types/match-detail-domain";
import { H2HCardWinProb } from "./h2h/H2HCardWinProb";
import { H2HCardAverageGoals } from "./h2h/H2HCardAverageGoals";
import { H2HCardForm } from "./h2h/H2HCardForm";

interface HeadToHeadTabProps {
  fixtureId: number;
  enabled?: boolean;
  /** Win probability from MatchOverviewDomain — available from Batch 3 overview hook */
  winProbability?: WinProbability | null;
  /**
   * H2H 主客胜负统计，来自 overview 接口的 h2hSummary 字段（H2H 接口无此字段）。
   * null 时 H2HCardWinProb 的 Previous Meetings 区块显示 '—'。
   */
  h2hSummary?: H2HSummary | null;
  homeShortCode?: string;
  awayShortCode?: string;
}

const TOTAL = 3;

/** H2H tab 局部 skeleton：与卡片同高的灰条 animate-pulse */
function H2HTabSkeleton() {
  return (
    <div className="px-[16px] animate-pulse" data-testid="h2h-skeleton">
      <div className="h-[120px] rounded-[8px] bg-white/10 mb-3" />
      <div className="h-[80px] rounded-[8px] bg-white/10" />
    </div>
  );
}

/** H2H tab 空态：错误/无数据时展示 */
function H2HTabError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="px-[16px] flex flex-col items-center gap-3 py-6 text-tertiary"
      data-testid="h2h-error"
    >
      <WarningCircleIcon size={28} weight="regular" className="opacity-50" />
      <p className="text-[11px]">Couldn&apos;t load · Tap to retry</p>
      <button
        type="button"
        onClick={onRetry}
        style={{ touchAction: "manipulation" }}
        className="flex items-center gap-1.5 text-[11px] text-secondary hover:text-primary transition-colors"
        data-testid="h2h-retry-btn"
      >
        <ArrowsClockwiseIcon size={14} weight="regular" />
        Retry
      </button>
    </div>
  );
}

export function HeadToHeadTab({
  fixtureId,
  enabled = false,
  winProbability = null,
  h2hSummary = null,
  homeShortCode = "HOM",
  awayShortCode = "AWA",
}: HeadToHeadTabProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useMatchDetailH2H(fixtureId, enabled);

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ["match-detail-h2h", fixtureId] });
  };

  const hasData = !isLoading && !isError && data != null;

  return (
    <div data-figma-node="5107:183016">
      {/* Sub-header — 22px 高 + 底部分隔线 */}
      <div
        className="relative h-[22px] mx-[8px] flex items-center justify-between border-b border-[rgba(224,224,224,0.12)]"
        data-figma-node="5107:183017"
      >
        <span className="text-[10px] leading-[12px] uppercase font-medium text-secondary">
          Head to Head
        </span>
        <div className="flex items-center gap-[10px] text-[10px] leading-[10px] uppercase text-secondary">
          <button
            type="button"
            onClick={() => setSlideIndex((s) => Math.max(0, s - 1))}
            disabled={slideIndex === 0 || !hasData}
            aria-label="Previous card"
            style={{ touchAction: "manipulation" }}
            className="flex items-center justify-center w-[12px] h-[12px] disabled:opacity-30 transition-opacity"
          >
            <CaretLeftIcon size={10} weight="bold" />
          </button>
          <span>
            {slideIndex + 1}/{TOTAL}
          </span>
          <button
            type="button"
            onClick={() => setSlideIndex((s) => Math.min(TOTAL - 1, s + 1))}
            disabled={slideIndex === TOTAL - 1 || !hasData}
            aria-label="Next card"
            style={{ touchAction: "manipulation" }}
            className="flex items-center justify-center w-[12px] h-[12px] disabled:opacity-30 transition-opacity"
          >
            <CaretRightIcon size={10} weight="bold" />
          </button>
        </div>
      </div>

      {/* 卡片内容 */}
      <div className="mt-1">
        {isLoading && <H2HTabSkeleton />}
        {!isLoading && (isError || !data) && <H2HTabError onRetry={handleRetry} />}
        {hasData && (
          <>
            {slideIndex === 0 && (
              <H2HCardWinProb
                winProbability={winProbability}
                h2hSummary={h2hSummary}
                homeShortCode={homeShortCode}
                awayShortCode={awayShortCode}
              />
            )}
            {slideIndex === 1 && (
              <H2HCardAverageGoals
                h2hAverageGoals={data.h2hAverageGoals}
                topScorers={data.topScorers}
                h2hSampleSize={data.h2hSampleSize}
              />
            )}
            {slideIndex === 2 && (
              <H2HCardForm
                h2hForm={data.h2hForm}
                homeShortCode={homeShortCode}
                awayShortCode={awayShortCode}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
