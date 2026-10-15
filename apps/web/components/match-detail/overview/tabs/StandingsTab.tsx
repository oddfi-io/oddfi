"use client";

// TODO: useWidget feature flag — default false, uses self-implemented standings below
import { useState } from "react";
import { ArrowsClockwiseIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMatchDetailStandings } from "@/hooks/useMatchDetailStandings";
import type { MatchStandingsRowDomain } from "@/types/match-detail-domain";
import type { StandingsScope, StandingsTrend } from "@/types/moneyline";
import UnderlineTabs, { type UnderlineTabItem } from "@/components/ui/UnderlineTabs";

interface StandingsTabProps {
  fixtureId: number;
  enabled?: boolean;
}

const SCOPES: UnderlineTabItem<StandingsScope>[] = [
  { key: "overall", label: "Overall" },
  { key: "home", label: "Home" },
  { key: "away", label: "Away" },
];

function TrendIndicator({ result }: { result: StandingsTrend | null }) {
  if (!result || result === "equal") {
    return <span className="w-1.5 h-1.5 rounded-full inline-block bg-tertiary opacity-50" />;
  }
  if (result === "up") {
    return <span className="text-fn-green text-[10px]">▲</span>;
  }
  return <span className="text-fn-red text-[10px]">▼</span>;
}

function PositionBar({ position }: { position: number }) {
  // 前 4 名 fn-green，5-6 名 fn-orange，其余 tertiary（与 outcome 色一致）
  const colorClass = position <= 4 ? "bg-fn-green" : position <= 6 ? "bg-fn-orange" : "bg-tertiary";
  return <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r ${colorClass}`} />;
}

function StandingRow({ row, idx }: { row: MatchStandingsRowDomain; idx: number }) {
  return (
    <tr
      className={[
        "text-[11px] border-b border-divider last:border-0",
        idx % 2 === 0 ? "" : "bg-white/[0.02]",
      ].join(" ")}
    >
      <td className="py-2 pl-4 pr-2 w-10 relative">
        <PositionBar position={row.position} />
        <div className="flex items-center gap-1">
          <span className="text-secondary font-medium">{row.position}</span>
          <TrendIndicator result={row.result} />
        </div>
      </td>
      <td className="py-2 pr-2 max-w-[90px]">
        <span className="text-primary font-medium truncate block">{row.teamName}</span>
      </td>
      <td className="py-2 px-1 text-center text-tertiary">{row.played}</td>
      <td className="py-2 px-1 text-center text-tertiary">{row.won}</td>
      <td className="py-2 px-1 text-center text-tertiary">{row.draw}</td>
      <td className="py-2 px-1 text-center text-tertiary">{row.lost}</td>
      <td className="py-2 px-1 text-center text-tertiary">
        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
      </td>
      <td className="py-2 pl-1 pr-3 text-center text-primary font-semibold">{row.points}</td>
    </tr>
  );
}

/** Standings tab 局部 skeleton */
function StandingsTabSkeleton() {
  return (
    <div className="animate-pulse" data-testid="standings-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-9 mx-1 mb-1 rounded bg-white/10" />
      ))}
    </div>
  );
}

/** Standings tab 空态 */
function StandingsTabError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-6 text-tertiary"
      data-testid="standings-error"
    >
      <WarningCircleIcon size={28} weight="regular" className="opacity-50" />
      <p className="text-[11px]">Couldn&apos;t load · Tap to retry</p>
      <button
        type="button"
        onClick={onRetry}
        style={{ touchAction: "manipulation" }}
        className="flex items-center gap-1.5 text-[11px] text-secondary hover:text-primary transition-colors"
        data-testid="standings-retry-btn"
      >
        <ArrowsClockwiseIcon size={14} weight="regular" />
        Retry
      </button>
    </div>
  );
}

export function StandingsTab({ fixtureId, enabled = false }: StandingsTabProps) {
  const [scope, setScope] = useState<StandingsScope>("overall");
  const queryClient = useQueryClient();
  const {
    rows: scopeRows,
    leagueName,
    seasonName,
    isLoading,
    isError,
  } = useMatchDetailStandings(fixtureId, scope, enabled);

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ["match-detail-standings", fixtureId] });
  };

  const rows = [...(scopeRows ?? [])].sort((a, b) => a.position - b.position);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-medium text-secondary uppercase tracking-wide">
          Standings
        </span>
      </div>

      {/* 联赛名称 — DD Batch 5: leagueName + seasonName */}
      <p className="text-[10px] text-tertiary mb-2">
        {leagueName ? `${leagueName} ${seasonName}` : "—"}
      </p>

      {/* Overall / Home / Away 子 tab — 复用 UnderlineTabs (sm size + bottom border) */}
      <UnderlineTabs
        tabs={SCOPES}
        value={scope}
        onChange={setScope}
        size="sm"
        borderPosition="bottom"
        className="mb-3"
        ariaLabel="Standings scope"
      />

      {isLoading && <StandingsTabSkeleton />}
      {!isLoading && (isError || !scopeRows) && <StandingsTabError onRetry={handleRetry} />}

      {/* 表格 */}
      {!isLoading && !isError && scopeRows && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[320px]">
            <thead>
              <tr className="text-[10px] text-tertiary uppercase tracking-wide border-b border-divider">
                <th className="py-1.5 pl-4 pr-2 text-left w-10">Pos</th>
                <th className="py-1.5 pr-2 text-left">Team</th>
                <th className="py-1.5 px-1 text-center">P</th>
                <th className="py-1.5 px-1 text-center">W</th>
                <th className="py-1.5 px-1 text-center">D</th>
                <th className="py-1.5 px-1 text-center">L</th>
                <th className="py-1.5 px-1 text-center">Diff</th>
                <th className="py-1.5 pl-1 pr-3 text-center">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <StandingRow key={row.participantId} row={row} idx={idx} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
