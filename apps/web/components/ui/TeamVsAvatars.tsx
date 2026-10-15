"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export interface TeamInfo {
  name: string;
  iconUrl?: string;
}

interface TeamVsAvatarsProps {
  home: TeamInfo;
  away: TeamInfo;
  /** 外容器尺寸（包含两圆叠加的总占位），默认 48px */
  size?: number;
  /** 单圆直径，默认 size - 12（48 → 36） */
  iconSize?: number;
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

interface TeamCircleProps {
  team: TeamInfo;
  diameter: number;
  /** 内描边（用于双圆叠加场景区分前后层），默认 false */
  withBorder?: boolean;
  /** 半透明态（用于负方暗示，DD-115 Match 列 dimmed 行），默认 false */
  dimmed?: boolean;
}

export function TeamCircle({
  team,
  diameter,
  withBorder = false,
  dimmed = false,
}: TeamCircleProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [team.iconUrl]);

  const showFallback = !team.iconUrl || imgError;

  return (
    <div
      className={[
        "rounded-full overflow-hidden bg-gradient-to-t from-[#f7fafc] to-[#d4dce3] shrink-0",
        withBorder ? "border-[2.25px] border-[#04060c]" : "",
        dimmed ? "opacity-50" : "",
      ].join(" ")}
      style={{ width: diameter, height: diameter }}
    >
      {showFallback ? (
        <div
          className="w-full h-full flex items-center justify-center font-semibold text-black/60"
          style={{ fontSize: diameter * 0.42 }}
        >
          {initialOf(team.name)}
        </div>
      ) : (
        <Image
          src={team.iconUrl!}
          alt={team.name}
          width={diameter}
          height={diameter}
          sizes={`${diameter}px`}
          className="w-full h-full object-contain p-[2px]"
          onError={() => setImgError(true)}
          unoptimized
        />
      )}
    </div>
  );
}

// 任一 name 为空 → 视为"无对手"场景（banner_single / 数据残缺），
// 两圆都按 "?" placeholder 渲染，避免一边显示选项首字符（如 "西"）一边显示 "?"
const PLACEHOLDER: TeamInfo = { name: "" };

export function TeamVsAvatars({ home, away, size = 48, iconSize }: TeamVsAvatarsProps) {
  const diameter = iconSize ?? size - 12;
  const incomplete = !home.name || !away.name;
  const homeTeam = incomplete ? PLACEHOLDER : home;
  const awayTeam = incomplete ? PLACEHOLDER : away;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute left-0 top-0">
        <TeamCircle team={homeTeam} diameter={diameter} withBorder={false} />
      </div>
      <div className="absolute bottom-0 right-0">
        <TeamCircle team={awayTeam} diameter={diameter} withBorder />
      </div>
    </div>
  );
}
