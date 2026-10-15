"use client";

/**
 * OverviewHeader — Figma 5107:182812
 *
 * 顶部条 57px：左侧主队球衣 + 球队名 · 中央日期/时间 pill · 客队名 + 右侧客队球衣。
 * 球衣实现见 ./Jersey（真实 URL + 加载失败本地灰度占位）。
 */

import type { MatchTeam, TeamSide } from "@/types/match-detail-domain";
import { formatMatchDate, formatMatchTime } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import Jersey from "./Jersey";

interface Props {
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  /** kickoff ISO 字符串（MatchOverviewDomain.kickoff.iso） */
  startingAt: string;
  locale: string;
}

interface TeamHalfProps {
  team: MatchTeam;
  side: TeamSide;
}

function TeamHalf({ team, side }: TeamHalfProps) {
  const isHome = side === "home";
  return (
    <div
      className={cn("absolute top-0 h-[56px] overflow-hidden", isHome ? "left-0" : "right-0")}
      style={isHome ? { right: "calc(50% + 9px)" } : { left: "calc(50% + 9px)" }}
    >
      {/* jerseyPath 变化时 key 触发 remount，让 Jersey useState 重新从最新 prop 初始化 */}
      <Jersey key={team.jerseyPath ?? `placeholder-${side}`} team={team} side={side} />
      <div
        className={cn(
          "absolute top-[27.75px] -translate-y-1/2",
          "text-[#e0e0e0] text-[14px] font-medium truncate",
          isHome ? "left-[56px] right-[8px]" : "right-[56px] left-[8px] text-right"
        )}
      >
        {team.name}
      </div>
    </div>
  );
}

export default function OverviewHeader({ homeTeam, awayTeam, startingAt, locale }: Props) {
  return (
    // 容器高 57px + 底部 12% 白色分割线
    <div
      className="relative h-[57px] border-b border-[rgba(224,224,224,0.12)]"
      data-figma-node="5107:182812"
    >
      {/* 中央日期/时间 pill — Figma 5107:182813 */}
      {/* @figma-hardcoded: #2c2830 date-pill-bg — pending design token */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 z-10
          flex items-center gap-[4px] px-[4px] h-[13px]
          bg-[#2c2830] border border-t-0 border-[rgba(224,224,224,0.12)]
          rounded-b-[2px] text-[#e0e0e0] text-[10px] font-normal opacity-80"
      >
        <span className="uppercase leading-none">{formatMatchDate(startingAt, locale)}</span>
        <span className="opacity-60 leading-none">|</span>
        <span className="leading-none">{formatMatchTime(startingAt, locale)}</span>
      </div>

      <TeamHalf team={homeTeam} side="home" />
      <TeamHalf team={awayTeam} side="away" />
    </div>
  );
}
