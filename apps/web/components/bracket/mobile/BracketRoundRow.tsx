// DD-095 BracketRoundRow — H5 R32 / R16 行 cell
// Figma 节点：4652:6736 — Variant5 (R32 白底) / Variant4 (R16 黑底)
// 单 cell：p-8 w-75 rounded-8，内部 ellipse(16) + VS(12) + ellipse(16)
// R32: 4 cell/行，bg-white，VS 黑色（text-static-black）
// R16: 4 cell/行，bg-tertiary，VS 白色（text-primary）

import Image from "next/image";

import type { BracketMatch, BracketTeam } from "@/lib/bracket/types";

interface BracketRoundRowProps {
  round: "r32" | "r16";
  matches: BracketMatch[];
  teams: Record<string, BracketTeam>;
}

interface MatchCellProps {
  match: BracketMatch;
  teams: Record<string, BracketTeam>;
  variant: "white" | "dark";
}

// Figma ellipse 占位色：白底卡 #5C5D6133（20% alpha），黑底卡 #5C5D6180（50% alpha）
const PLACEHOLDER_COLOR = {
  white: "#5C5D6133",
  dark: "#5C5D6180",
} as const;

function FlagOrPlaceholder({
  team,
  variant,
}: {
  team: BracketTeam | null;
  variant: "white" | "dark";
}) {
  if (!team) {
    return (
      <div
        className="size-[16px] rounded-full shrink-0"
        style={{ backgroundColor: PLACEHOLDER_COLOR[variant] }}
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

function MatchCell({ match, teams, variant }: MatchCellProps) {
  const home = match.homeTeamId ? teams[match.homeTeamId] : null;
  const away = match.awayTeamId ? teams[match.awayTeamId] : null;

  const isWhite = variant === "white";

  return (
    <div
      className={[
        "flex items-center justify-center gap-[6px] flex-1 min-w-0 h-[32px] p-[8px] rounded-[8px]",
        isWhite ? "bg-white" : "bg-tertiary",
      ].join(" ")}
    >
      <FlagOrPlaceholder team={home} variant={variant} />
      <span
        className={[
          "text-[12px] font-medium leading-none",
          isWhite ? "text-static-black" : "text-primary",
        ].join(" ")}
      >
        VS
      </span>
      <FlagOrPlaceholder team={away} variant={variant} />
    </div>
  );
}

export default function BracketRoundRow({ round, matches, teams }: BracketRoundRowProps) {
  const variant: "white" | "dark" = round === "r32" ? "white" : "dark";

  return (
    <div className="flex items-center gap-[16px] w-full">
      {matches.map((match) => (
        <MatchCell key={match.id} match={match} teams={teams} variant={variant} />
      ))}
    </div>
  );
}
