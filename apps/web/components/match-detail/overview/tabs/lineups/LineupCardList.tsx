import type { LineupFormation } from "@/types/moneyline";
import { HOME_BLUE, AWAY_ORANGE } from "@/lib/match-colors";
import { cn } from "@/lib/utils";

interface LineupCardListProps {
  lineup: LineupFormation;
  team: "home" | "away";
}

const TEAM_COLOR: Record<"home" | "away", string> = {
  home: HOME_BLUE,
  away: AWAY_ORANGE,
};

export function LineupCardList({ lineup, team }: LineupCardListProps) {
  const starters = lineup.players
    .filter((p) => p.type_id === 11)
    .sort((a, b) => a.formation_position - b.formation_position);

  const accentColor = TEAM_COLOR[team];

  return (
    <div>
      {/* 队名 + 标题行 */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[13px] font-semibold text-primary">{lineup.team_name}</span>
        <span className="text-[10px] text-tertiary">· Starting Lineup</span>
      </div>

      <div className="-mx-1">
        {starters.map((player, idx) => (
          <div
            key={player.player_id}
            className={cn(
              "flex items-center gap-2 py-1.5 px-2 border-b border-divider last:border-0 text-[11px]",
              idx % 2 !== 0 && "bg-white/[0.02]"
            )}
          >
            {/* 号码 */}
            <span className="font-semibold w-5 text-center shrink-0" style={{ color: accentColor }}>
              {player.jersey_number}
            </span>
            {/* 名字 */}
            <span className="text-primary font-medium truncate">{player.player_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
