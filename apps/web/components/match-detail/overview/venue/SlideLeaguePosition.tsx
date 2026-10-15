"use client";

// @reference-screenshot: venue-2-league-position.png

/** DD-104 Batch 3：接 MatchOverviewDomain.standingsRank/formPercentage/recentResults。 */
import type { MatchOutcomeDomain } from "@/types/match-detail-domain";
import { HOME_BLUE, AWAY_ORANGE, OUTCOME_HEX } from "@/lib/match-colors";

interface Props {
  standingsRank: { home: number | null; away: number | null };
  formPercentage: { home: number; away: number };
  recentResults: { home: MatchOutcomeDomain[]; away: MatchOutcomeDomain[] };
}

const MAX_RANK = 20;

export default function SlideLeaguePosition({
  standingsRank,
  formPercentage,
  recentResults,
}: Props) {
  const homeBarHeight =
    standingsRank?.home != null ? ((MAX_RANK - standingsRank.home + 1) / MAX_RANK) * 100 : 0;
  const awayBarHeight =
    standingsRank?.away != null ? ((MAX_RANK - standingsRank.away + 1) / MAX_RANK) * 100 : 0;

  return (
    <div className="flex h-full flex-col justify-between px-3 py-2.5">
      <p className="text-center text-[11px] font-medium text-white/70">League Position</p>

      <div className="flex items-end justify-center gap-3">
        <div className="flex flex-col items-center">
          <span className="text-[12px] font-semibold leading-none" style={{ color: HOME_BLUE }}>
            {formPercentage.home}%
          </span>
          <div className="relative mt-1 h-8 w-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full"
              style={{ height: `${homeBarHeight}%`, backgroundColor: HOME_BLUE }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <div
            className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold text-white"
            style={{ backgroundColor: HOME_BLUE }}
          >
            {standingsRank?.home ?? "—"}
          </div>
          <div className="h-3 w-px bg-white/20" />
          <div
            className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold text-white"
            style={{ backgroundColor: AWAY_ORANGE }}
          >
            {standingsRank?.away ?? "—"}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[12px] font-semibold leading-none" style={{ color: AWAY_ORANGE }}>
            {formPercentage.away}%
          </span>
          <div className="relative mt-1 h-8 w-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full"
              style={{ height: `${awayBarHeight}%`, backgroundColor: AWAY_ORANGE }}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-1">
        <div className="flex gap-0.5">
          {recentResults.home.map((outcome, i) => (
            <div
              key={i}
              className="flex h-[18px] w-[18px] items-center justify-center rounded text-[10px] font-bold text-white"
              style={{ backgroundColor: OUTCOME_HEX[outcome] }}
            >
              {outcome}
            </div>
          ))}
        </div>
        <div className="flex gap-0.5">
          {recentResults.away.map((outcome, i) => (
            <div
              key={i}
              className="flex h-[18px] w-[18px] items-center justify-center rounded text-[10px] font-bold text-white"
              style={{ backgroundColor: OUTCOME_HEX[outcome] }}
            >
              {outcome}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
