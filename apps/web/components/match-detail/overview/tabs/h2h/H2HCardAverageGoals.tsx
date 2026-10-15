import type { H2HAverageGoals, TopScorer } from "@/types/match-detail-domain";
import { HOME_BLUE as HOME_COLOR, AWAY_ORANGE as AWAY_COLOR } from "@/lib/match-colors";

interface H2HCardAverageGoalsProps {
  h2hAverageGoals: H2HAverageGoals;
  topScorers: { home: TopScorer | null; away: TopScorer | null };
  h2hSampleSize: number;
}

function GoalsBar({ home, away }: { home: number; away: number }) {
  const total = home + away;
  const homePct = total > 0 ? (home / total) * 100 : 50;
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
      <div
        className="rounded-l-full"
        style={{ width: `${homePct}%`, backgroundColor: HOME_COLOR }}
      />
      <div className="rounded-r-full flex-1" style={{ backgroundColor: AWAY_COLOR }} />
    </div>
  );
}

/** 国旗 emoji 辅助 */
function flagEmoji(position: string): string {
  // 仅用于 mock 演示，按球员位置做占位
  return position === "Forward" ? "🇧🇷" : "🇫🇷";
}

export function H2HCardAverageGoals({
  h2hAverageGoals,
  topScorers,
  h2hSampleSize,
}: H2HCardAverageGoalsProps) {
  return (
    <div className="space-y-4">
      {/* AVERAGE GOALS */}
      <div>
        <p className="text-[10px] font-medium text-secondary uppercase tracking-wide text-center mb-3">
          Average Goals
        </p>

        {/* SCORED 行 */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[16px] font-bold w-10" style={{ color: HOME_COLOR }}>
            {h2hAverageGoals.scored.home}
          </span>
          <div className="flex-1 mx-3 space-y-1">
            <p className="text-[10px] text-tertiary text-center uppercase tracking-wide">Scored</p>
            <GoalsBar home={h2hAverageGoals.scored.home} away={h2hAverageGoals.scored.away} />
          </div>
          <span className="text-[16px] font-bold w-10 text-right" style={{ color: AWAY_COLOR }}>
            {h2hAverageGoals.scored.away}
          </span>
        </div>

        {/* CONCEDED 行 */}
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-bold w-10" style={{ color: HOME_COLOR }}>
            {h2hAverageGoals.conceded.home}
          </span>
          <div className="flex-1 mx-3 space-y-1">
            <p className="text-[10px] text-tertiary text-center uppercase tracking-wide">
              Conceded
            </p>
            <GoalsBar home={h2hAverageGoals.conceded.home} away={h2hAverageGoals.conceded.away} />
          </div>
          <span className="text-[16px] font-bold w-10 text-right" style={{ color: AWAY_COLOR }}>
            {h2hAverageGoals.conceded.away}
          </span>
        </div>

        {/* DD-104 Batch 4: h2hSampleSize */}
        <p className="text-[10px] text-tertiary text-center mt-2">From {h2hSampleSize} matches</p>
      </div>

      {/* TOP SCORERS */}
      {(topScorers.home || topScorers.away) && (
        <div>
          <p className="text-[10px] font-medium text-secondary uppercase tracking-wide text-center mb-3">
            Top Scorers
          </p>

          <div className="flex items-center justify-between gap-2">
            {/* Home scorer */}
            {topScorers.home && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[22px] font-bold shrink-0" style={{ color: HOME_COLOR }}>
                  {topScorers.home.goals}
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-primary truncate">
                    {topScorers.home.player_name.split(",")[0]},{" "}
                    {topScorers.home.player_name.split(",")[1]?.trim()}
                  </p>
                  <p className="text-[10px] text-tertiary flex items-center gap-1">
                    {flagEmoji(topScorers.home.position)}{" "}
                    <span className="uppercase">{topScorers.home.position}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Separator */}
            {topScorers.home && topScorers.away && <div className="w-px h-8 bg-divider shrink-0" />}

            {/* Away scorer */}
            {topScorers.away && (
              <div className="flex items-center gap-2 min-w-0 justify-end">
                <div className="min-w-0 text-right">
                  <p className="text-[12px] font-medium text-primary truncate">
                    {topScorers.away.player_name.split(",")[0]},{" "}
                    {topScorers.away.player_name.split(",")[1]?.trim()}
                  </p>
                  <p className="text-[10px] text-tertiary flex items-center gap-1 justify-end">
                    <span className="uppercase">{topScorers.away.position}</span>{" "}
                    {flagEmoji(topScorers.away.position)}
                  </p>
                </div>
                <span className="text-[22px] font-bold shrink-0" style={{ color: AWAY_COLOR }}>
                  {topScorers.away.goals}
                </span>
              </div>
            )}
          </div>

          {/* 组合 bar */}
          {topScorers.home && topScorers.away && (
            <div className="mt-3">
              <GoalsBar home={topScorers.home.goals} away={topScorers.away.goals} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
