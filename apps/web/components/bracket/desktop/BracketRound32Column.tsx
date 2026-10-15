// DD-095 BracketRound32Column — R32 双列（Figma 4474:168268 80×996）
// absolute 布局：8 frame 按 metadata 给定 y 起始 + 高度（42/47/50 三档）
// 顶端对齐 Group 卡顶端，底端对齐 Group 卡底端

import type { BracketMatch, BracketTeam, GroupKey, TournamentBracket } from "@/lib/bracket/types";

import BracketR32MatchCell from "./BracketR32MatchCell";

interface BracketRound32ColumnProps {
  bracket: TournamentBracket;
  side: "left" | "right";
  onHoverStart?: (e: React.MouseEvent<HTMLDivElement>, groupKey: GroupKey) => void;
  onHoverEnd?: () => void;
}

// 每 frame：y 起始 + cell 高度（home + away 两 cell 内 gap 固定 8px）
const FRAME_LAYOUT: { y: number; cellHeight: 42 | 47 | 50 }[] = [
  { y: 0, cellHeight: 42 },
  { y: 119.71, cellHeight: 42 },
  { y: 239.43, cellHeight: 47 },
  { y: 369.14, cellHeight: 47 },
  { y: 498.86, cellHeight: 47 },
  { y: 628.57, cellHeight: 47 },
  { y: 758.29, cellHeight: 47 },
  { y: 888, cellHeight: 50 },
];

export default function BracketRound32Column({
  bracket,
  side,
  onHoverStart,
  onHoverEnd,
}: BracketRound32ColumnProps) {
  const r32Matches = bracket.matches.filter((m) => m.round === "r32");
  const matches: BracketMatch[] =
    side === "left" ? r32Matches.slice(0, 8) : r32Matches.slice(8, 16);

  const getTeam = (teamId: string | null): BracketTeam | null => {
    if (!teamId) return null;
    return bracket.teams[teamId] ?? null;
  };

  return (
    <div className="relative w-[80px] h-[996px] flex-shrink-0">
      {matches.map((match, idx) => {
        const slot = FRAME_LAYOUT[idx];
        if (!slot) return null;
        return (
          <div
            key={match.id}
            className="absolute left-0 w-[80px] flex flex-col gap-[8px]"
            style={{ top: slot.y }}
          >
            <BracketR32MatchCell
              match={match}
              team={getTeam(match.homeTeamId)}
              cellHeight={slot.cellHeight}
              groupKey={match.groupKey}
              onHoverStart={onHoverStart}
              onHoverEnd={onHoverEnd}
            />
            <BracketR32MatchCell
              match={match}
              team={getTeam(match.awayTeamId)}
              cellHeight={slot.cellHeight}
              groupKey={match.groupKey}
              onHoverStart={onHoverStart}
              onHoverEnd={onHoverEnd}
            />
          </div>
        );
      })}
    </div>
  );
}
