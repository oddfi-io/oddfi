// DD-095 BracketQfSfCell — H5 QF / SF 单 cell
// Figma 节点：4676:135139（SF）/ 4676:135208（QF 行）
// 尺寸：107×32 px-24 py-8 rounded-8，bg-tertiary
// 内容：ellipse(16) + VS(12 white) + ellipse(16)，items-end justify-center gap-6

import Image from "next/image";

import type { BracketMatch, BracketTeam } from "@/lib/bracket/types";

interface BracketQfSfCellProps {
  match: BracketMatch;
  teams: Record<string, BracketTeam>;
}

// QF/SF cell 始终为黑底（bg-tertiary）→ 占位色用 #5C5D6180（50% alpha，与 R16 黑底卡一致）
const PLACEHOLDER_DARK = "#5C5D6180";

function FlagOrPlaceholder({ team }: { team: BracketTeam | null }) {
  if (!team) {
    return (
      <div
        className="size-[16px] rounded-full shrink-0"
        style={{ backgroundColor: PLACEHOLDER_DARK }}
      />
    );
  }
  return (
    <Image
      src={`/images/flags/${team.iso2}.svg`}
      alt={team.name}
      width={16}
      height={16}
      sizes="16px"
      className="size-[16px] rounded-full object-cover shrink-0"
    />
  );
}

export default function BracketQfSfCell({ match, teams }: BracketQfSfCellProps) {
  const home = match.homeTeamId ? teams[match.homeTeamId] : null;
  const away = match.awayTeamId ? teams[match.awayTeamId] : null;

  return (
    <div className="flex items-center justify-center gap-[6px] w-[107px] h-[32px] px-[24px] py-[8px] rounded-[8px] bg-tertiary shrink-0">
      <FlagOrPlaceholder team={home} />
      <span className="text-[12px] font-medium text-primary leading-none">VS</span>
      <FlagOrPlaceholder team={away} />
    </div>
  );
}
