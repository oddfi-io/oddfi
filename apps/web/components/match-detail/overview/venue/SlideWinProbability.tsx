"use client";

// @reference-screenshot: venue-4-win-probability.png

/** DD-104 Batch 3：接 MatchOverviewDomain.winProbability（可为 null）+ h2hSummary + homeTeam.shortCode + awayTeam.shortCode。 */
import type { WinProbability, H2HSummary } from "@/types/match-detail-domain";
import { HOME_BLUE, AWAY_ORANGE } from "@/lib/match-colors";

interface Props {
  winProbability: WinProbability | null;
  h2hSummary: H2HSummary | null;
  homeShortCode: string;
  awayShortCode: string;
}

const DRAW_BAR = "rgba(255,255,255,0.4)";

interface TriColorBarProps {
  leftPct: number;
  midPct: number;
  rightPct: number;
}

function TriColorBar({ leftPct, midPct, rightPct }: TriColorBarProps) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      <div style={{ width: `${leftPct}%`, backgroundColor: HOME_BLUE }} />
      <div style={{ width: `${midPct}%`, backgroundColor: DRAW_BAR }} />
      <div style={{ width: `${rightPct}%`, backgroundColor: AWAY_ORANGE }} />
    </div>
  );
}

export default function SlideWinProbability({
  winProbability,
  h2hSummary,
  homeShortCode,
  awayShortCode,
}: Props) {
  const h2hTotal = h2hSummary ? h2hSummary.home_wins + h2hSummary.draws + h2hSummary.away_wins : 0;
  const h2hHomePct = h2hTotal > 0 && h2hSummary ? (h2hSummary.home_wins / h2hTotal) * 100 : 0;
  const h2hDrawPct = h2hTotal > 0 && h2hSummary ? (h2hSummary.draws / h2hTotal) * 100 : 0;
  const h2hAwayPct = h2hTotal > 0 && h2hSummary ? (h2hSummary.away_wins / h2hTotal) * 100 : 0;

  return (
    <div className="flex h-full flex-col justify-between px-3 pt-2 pb-3">
      {/* Win Probability 区块 */}
      <div className="flex flex-col gap-1">
        <p className="text-center text-[11px] font-medium text-white/70">Win Probability</p>
        {/* 三列数字 — winProbability === null 时显示 '—' */}
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-bold leading-none" style={{ color: HOME_BLUE }}>
              {winProbability !== null ? (
                <>
                  {winProbability.home}
                  <span className="text-[11px]">%</span>
                </>
              ) : (
                "—"
              )}
            </span>
            <span className="text-[10px] text-white/50">{homeShortCode}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-base font-bold leading-none text-white/70">
              {winProbability !== null ? (
                <>
                  {winProbability.draw}
                  <span className="text-[11px]">%</span>
                </>
              ) : (
                "—"
              )}
            </span>
            <span className="text-[10px] text-white/50">DRAW</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-base font-bold leading-none" style={{ color: AWAY_ORANGE }}>
              {winProbability !== null ? (
                <>
                  {winProbability.away}
                  <span className="text-[11px]">%</span>
                </>
              ) : (
                "—"
              )}
            </span>
            <span className="text-[10px] text-white/50">{awayShortCode}</span>
          </div>
        </div>
        {/* 三色 bar */}
        {winProbability !== null && (
          <TriColorBar
            leftPct={winProbability.home}
            midPct={winProbability.draw}
            rightPct={winProbability.away}
          />
        )}
      </div>

      {/* Previous Meetings 区块 */}
      <div className="flex flex-col gap-1">
        <p className="text-center text-[11px] font-medium text-white/70">Previous Meetings</p>
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-bold leading-none" style={{ color: HOME_BLUE }}>
              {h2hSummary != null ? h2hSummary.home_wins : "—"}
            </span>
            <span className="text-[10px] text-white/50">WINS</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-base font-bold leading-none text-white/70">
              {h2hSummary != null ? h2hSummary.draws : "—"}
            </span>
            <span className="text-[10px] text-white/50">DRAWS</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-base font-bold leading-none" style={{ color: AWAY_ORANGE }}>
              {h2hSummary != null ? h2hSummary.away_wins : "—"}
            </span>
            <span className="text-[10px] text-white/50">WINS</span>
          </div>
        </div>
        {h2hSummary != null && (
          <TriColorBar leftPct={h2hHomePct} midPct={h2hDrawPct} rightPct={h2hAwayPct} />
        )}
      </div>
    </div>
  );
}
