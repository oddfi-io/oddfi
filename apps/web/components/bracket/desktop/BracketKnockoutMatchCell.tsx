// DD-095 BracketKnockoutMatchCell — R16 / QF / SF 单队 cell
// Figma 4474:168342 / 168362（已晋级 bg-tertiary + 国旗 + Orbitron 缩写）
//       4652:7395（占位 bg-tertiary + "TBD"）
// 与 R32 相比：尺寸宽 84，圆角 8，padding 一致

import Image from "next/image";

import type { BracketTeam } from "@/lib/bracket/types";

interface BracketKnockoutMatchCellProps {
  team: BracketTeam | null;
  width: 84;
  height: number;
}

export default function BracketKnockoutMatchCell({
  team,
  width,
  height,
}: BracketKnockoutMatchCellProps) {
  const baseClass = "flex items-center justify-center gap-[4px] rounded-[8px] bg-tertiary";

  if (!team) {
    return (
      <div className={baseClass} style={{ width, height }}>
        <span
          className="text-[14px] font-medium text-secondary leading-none whitespace-nowrap"
          style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
        >
          TBD
        </span>
      </div>
    );
  }

  return (
    <div className={`${baseClass} px-[12px]`} style={{ width, height }}>
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
