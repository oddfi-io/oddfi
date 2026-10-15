"use client";

// Settled 表 Match 列 — Figma 6712:103076 / 6714:103780
// 主队上 / 客队下 + 20×20 队标 + 比分 + 胜方箭头。
//
// 视觉规则：
// - 胜方行 text-primary + 队标 full opacity + 箭头
// - 负方行 text-tertiary + 队标 opacity-50 + 比分 text-secondary + 无箭头
// - 平局 / 比分缺失 两行都 text-primary 无箭头（避免误导胜方）

import { MatchWinnerArrow } from "@/components/icons/MatchWinnerArrow";
import { TeamCircle, type TeamInfo } from "@/components/ui/TeamVsAvatars";

interface Props {
  home: TeamInfo;
  away: TeamInfo;
  homeScore?: number;
  awayScore?: number;
}

type Winner = "home" | "away" | "draw" | "unknown";

function deriveWinner(home?: number, away?: number): Winner {
  if (home == null || away == null) return "unknown";
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

function ScoreText({ score, dimmed }: { score?: number; dimmed: boolean }) {
  return (
    <span
      className={`text-[14px] font-medium leading-[18px] whitespace-nowrap ${
        dimmed ? "text-secondary" : "text-primary"
      }`}
    >
      {score == null ? "--" : String(score)}
    </span>
  );
}

function TeamRow({
  team,
  score,
  dim,
  showArrow,
}: {
  team: TeamInfo;
  score?: number;
  dim: boolean;
  showArrow: boolean;
}) {
  return (
    <div className="flex gap-[24px] items-center">
      <div className="flex gap-[8px] items-center">
        <TeamCircle team={team} diameter={20} dimmed={dim} />
        <span
          className={`text-[14px] font-bold leading-[18px] whitespace-nowrap ${
            dim ? "text-tertiary" : "text-primary"
          }`}
        >
          {team.name}
        </span>
      </div>
      <div className="flex gap-[8px] items-center">
        <ScoreText score={score} dimmed={dim} />
        {showArrow && <MatchWinnerArrow className="text-brand-default" />}
      </div>
    </div>
  );
}

export function TeamVsVerticalCell({ home, away, homeScore, awayScore }: Props) {
  const winner = deriveWinner(homeScore, awayScore);

  return (
    <div className="flex flex-col gap-[8px] items-start justify-center">
      <TeamRow
        team={home}
        score={homeScore}
        dim={winner === "away"}
        showArrow={winner === "home"}
      />
      <TeamRow
        team={away}
        score={awayScore}
        dim={winner === "home"}
        showArrow={winner === "away"}
      />
    </div>
  );
}
