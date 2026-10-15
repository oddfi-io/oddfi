"use client";

import { useState } from "react";
import {
  CaretLeftIcon,
  CaretRightIcon,
  ArrowsClockwiseIcon,
  WarningCircleIcon,
  ClockIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMatchDetailLineups } from "@/hooks/useMatchDetailLineups";
import { LineupCardList } from "./lineups/LineupCardList";
import { LineupCardFormation } from "./lineups/LineupCardFormation";

interface LineupsTabProps {
  fixtureId: number;
  enabled?: boolean;
  /** Locale for availableAt time formatting */
  locale?: string;
}

/** Lineups tab 局部 skeleton */
function LineupsTabSkeleton() {
  return (
    <div className="animate-pulse" data-testid="lineups-skeleton">
      <div className="h-6 w-48 mx-auto rounded bg-white/10 mb-4" />
      <div className="h-[200px] rounded bg-white/10" />
    </div>
  );
}

/** Lineups tab 空态：错误/无数据 */
function LineupsTabError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-6 text-tertiary"
      data-testid="lineups-error"
    >
      <WarningCircleIcon size={28} weight="regular" className="opacity-50" />
      <p className="text-[11px]">Couldn&apos;t load · Tap to retry</p>
      <button
        type="button"
        onClick={onRetry}
        style={{ touchAction: "manipulation" }}
        className="flex items-center gap-1.5 text-[11px] text-secondary hover:text-primary transition-colors"
        data-testid="lineups-retry-btn"
      >
        <ArrowsClockwiseIcon size={14} weight="regular" />
        Retry
      </button>
    </div>
  );
}

/** Lineups tab 阵容未公布空态（赛前 ≥ 1h） */
function LineupsNotAvailableYet({ availableAt, locale }: { availableAt: Date; locale?: string }) {
  const timeStr = availableAt.toLocaleString(locale ?? "en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="flex flex-col items-center gap-3 py-8 text-tertiary"
      data-testid="lineups-not-available"
    >
      <ClockIcon size={28} weight="regular" className="opacity-50" />
      <p className="text-[11px] text-center">Lineup available 1h before kickoff</p>
      <p className="text-[11px] text-secondary">{timeStr}</p>
    </div>
  );
}

export function LineupsTab({ fixtureId, enabled = false, locale }: LineupsTabProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const total = 3;
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useMatchDetailLineups(fixtureId, enabled);

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ["match-detail-lineups", fixtureId] });
  };

  const hasLineups = !isLoading && !isError && data != null && data.lineups != null;
  const isNotAvailableYet = !isLoading && !isError && data != null && data.lineups == null;

  return (
    <div>
      {/* 顶部标题行 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-medium text-secondary tracking-wide uppercase">
          Usual Lineup (Recent Matches)
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSlideIndex((s) => Math.max(0, s - 1))}
            disabled={slideIndex === 0 || !hasLineups}
            style={{ touchAction: "manipulation" }}
            className="p-1 text-tertiary disabled:opacity-30 hover:text-secondary transition-colors"
          >
            <CaretLeftIcon size={14} />
          </button>
          <span className="text-[11px] text-tertiary w-8 text-center">
            {slideIndex + 1}/{total}
          </span>
          <button
            onClick={() => setSlideIndex((s) => Math.min(total - 1, s + 1))}
            disabled={slideIndex === total - 1 || !hasLineups}
            style={{ touchAction: "manipulation" }}
            className="p-1 text-tertiary disabled:opacity-30 hover:text-secondary transition-colors"
          >
            <CaretRightIcon size={14} />
          </button>
        </div>
      </div>

      {/* 状态渲染 */}
      {isLoading && <LineupsTabSkeleton />}
      {!isLoading && (isError || !data) && <LineupsTabError onRetry={handleRetry} />}
      {isNotAvailableYet && (
        <LineupsNotAvailableYet availableAt={data!.availableAt} locale={locale} />
      )}

      {/* 卡片内容 */}
      {hasLineups && (
        <>
          {slideIndex === 0 && <LineupCardList lineup={data!.lineups!.home} team="home" />}
          {slideIndex === 1 && (
            <LineupCardFormation home={data!.lineups!.home} away={data!.lineups!.away} />
          )}
          {slideIndex === 2 && <LineupCardList lineup={data!.lineups!.away} team="away" />}
        </>
      )}
    </div>
  );
}
