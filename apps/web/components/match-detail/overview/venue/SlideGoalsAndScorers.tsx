"use client";

// @reference-screenshot: venue-1-goals-scorers.png

/** DD-104 Batch 3：接 MatchOverviewDomain.seasonGoals + topScorers（可为 null）。 */
import type { TopScorer } from "@/types/match-detail-domain";
import { HOME_BLUE, AWAY_ORANGE } from "@/lib/match-colors";
import { getPlayerLastName } from "@/lib/format/player-name";

interface Props {
  seasonGoals: { home: number | null; away: number | null };
  topScorers: { home: TopScorer | null; away: TopScorer | null };
}

export default function SlideGoalsAndScorers({ seasonGoals, topScorers }: Props) {
  const homeGoals = seasonGoals.home;
  const awayGoals = seasonGoals.away;
  const total = homeGoals !== null && awayGoals !== null ? homeGoals + awayGoals : 0;
  const homeWidthPct = total > 0 && homeGoals !== null ? (homeGoals / total) * 100 : 50;
  const awayWidthPct = total > 0 && awayGoals !== null ? (awayGoals / total) * 100 : 50;

  const homeScorer = topScorers.home;
  const awayScorer = topScorers.away;
  const homeShortName = homeScorer ? getPlayerLastName(homeScorer.player_name) : null;
  const awayShortName = awayScorer ? getPlayerLastName(awayScorer.player_name) : null;

  return (
    <div className="flex h-full flex-col justify-between px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold leading-none" style={{ color: HOME_BLUE }}>
          {homeGoals !== null ? homeGoals : "—"}
        </span>
        <span className="text-center text-[11px] font-medium text-white/70">
          Goals Scored / Season
        </span>
        <span className="text-2xl font-bold leading-none" style={{ color: AWAY_ORANGE }}>
          {awayGoals !== null ? awayGoals : "—"}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{ width: `${homeWidthPct}%`, backgroundColor: HOME_BLUE }}
          />
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{ width: `${awayWidthPct}%`, backgroundColor: AWAY_ORANGE }}
          />
        </div>
      </div>

      <div className="border-t border-white/10 pt-2">
        <p className="mb-1 text-center text-[11px] font-medium text-white/70">Top Scorers</p>
        <div className="flex items-baseline justify-between gap-2">
          {homeScorer && homeShortName ? (
            <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
              <span className="text-lg font-bold leading-none" style={{ color: HOME_BLUE }}>
                {homeScorer.goals}
              </span>
              <span className="min-w-0 truncate text-[12px] font-semibold text-white">
                {homeShortName}
              </span>
            </div>
          ) : (
            <span className="text-xs text-white/50">No data</span>
          )}
          {awayScorer && awayShortName ? (
            <div className="flex min-w-0 flex-1 items-baseline justify-end gap-1.5">
              <span className="min-w-0 truncate text-right text-[12px] font-semibold text-white">
                {awayShortName}
              </span>
              <span className="text-lg font-bold leading-none" style={{ color: AWAY_ORANGE }}>
                {awayScorer.goals}
              </span>
            </div>
          ) : (
            <span className="text-xs text-white/50 text-right">No data</span>
          )}
        </div>
      </div>
    </div>
  );
}
