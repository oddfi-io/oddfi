// DD-095 BracketR32MatchCell — R32 单队 cell（80×42/47/50）
// Figma 4474:168260（已晋级 bg-tertiary 暗 + 国旗 + Orbitron 缩写）
//        4474:168334（占位 bg-primary 白 + Noto Sans SC Bold 黑色 TBD）
// data-r32-cell + data-group 属性供 hover 弹层定位

import Image from "next/image";

import type { BracketMatch, BracketTeam, GroupKey } from "@/lib/bracket/types";

interface BracketR32MatchCellProps {
  match: BracketMatch;
  team: BracketTeam | null;
  cellHeight?: 42 | 47 | 50;
  groupKey?: GroupKey;
  onHoverStart?: (e: React.MouseEvent<HTMLDivElement>, groupKey: GroupKey) => void;
  onHoverEnd?: () => void;
}

export default function BracketR32MatchCell({
  match,
  team,
  cellHeight = 42,
  groupKey,
  onHoverStart,
  onHoverEnd,
}: BracketR32MatchCellProps) {
  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (groupKey && onHoverStart) {
      onHoverStart(e, groupKey);
    }
  };

  const baseClass =
    "w-[80px] flex items-center justify-center gap-[4px] rounded-[8px] cursor-pointer transition-colors";

  if (!team) {
    return (
      // @figma-hardcoded: #ffffff R32 占位 cell 背景 + #04060c 文字色
      // （Figma 节点 4474:168334 fill 为 var(bg/primary)=white，与项目 dark theme 的 bg-primary 同名不同值，必须用直接色值）
      <div
        data-r32-cell={match.id}
        data-group={groupKey ?? ""}
        className={`${baseClass} bg-white text-[#04060c] hover:opacity-90`}
        style={{ height: cellHeight }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={onHoverEnd}
      >
        <span
          className="text-[14px] font-bold leading-none whitespace-nowrap"
          style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
        >
          TBD
        </span>
      </div>
    );
  }

  return (
    <div
      data-r32-cell={match.id}
      data-group={groupKey ?? ""}
      className={`${baseClass} bg-tertiary px-[12px] hover:bg-secondary`}
      style={{ height: cellHeight }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onHoverEnd}
    >
      <Image
        src={`/images/flags/${team.iso2}.svg`}
        alt={team.name}
        width={16}
        height={16}
        sizes="16px"
        className="shrink-0 rounded-full object-cover"
      />
      <span
        className="text-[14px] font-semibold text-primary uppercase leading-none whitespace-nowrap"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
      >
        {team.iso2.toUpperCase()}
      </span>
    </div>
  );
}
