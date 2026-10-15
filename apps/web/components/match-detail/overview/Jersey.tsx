"use client";

/**
 * Jersey — OverviewHeader 顶部条左右两侧 96×96 球衣展示。
 *
 * 数据：MatchTeam.jerseyPath（来自 detail/fixture 接口 team_kits[type=home/away]）。
 * 降级：URL 缺失 / 加载失败（404 / 网络错） → 本地灰度占位 SVG，区分 home/away。
 *
 * 切赛事时由调用方传 key={team.jerseyPath ?? `placeholder-${side}`} 强制重新挂载，
 * 让 useState 重新从最新 jerseyPath 初始化，无需 useEffect 反同步 props。
 */

import Image from "next/image";
import { useState } from "react";
import type { MatchTeam, TeamSide } from "@/types/match-detail-domain";
import { cn } from "@/lib/utils";

const PLACEHOLDER_HOME = "/images/jerseys/home-default.svg";
const PLACEHOLDER_AWAY = "/images/jerseys/away-default.svg";

interface Props {
  team: MatchTeam;
  side: TeamSide;
}

export default function Jersey({ team, side }: Props) {
  const placeholder = side === "home" ? PLACEHOLDER_HOME : PLACEHOLDER_AWAY;
  const [src, setSrc] = useState(team.jerseyPath || placeholder);
  const isPlaceholder = src === placeholder;

  return (
    <div
      className="absolute size-[96px] top-[calc(50%+28px)] -translate-y-1/2 overflow-hidden pointer-events-none"
      style={side === "home" ? { left: -40 } : { right: -40 }}
      data-figma-node={side === "home" ? "5107:182819" : "5107:182831"}
    >
      <Image
        src={src}
        alt={`${team.name} ${side} jersey`}
        width={96}
        height={96}
        unoptimized={isPlaceholder}
        className={cn(
          "absolute inset-0 size-full object-contain",
          // SportMonks 真实球衣 PNG 内含 ~38% 留白（jersey 居中 + 透明边距），
          // scale-[1.6] 让视觉大小与占位 SVG（preserveAspectRatio=none 铺满）对齐
          !isPlaceholder && "scale-[1.6]",
          // 占位状态加灰度 + 半透明，让用户一眼区分"非真实球衣"
          isPlaceholder && "grayscale opacity-60"
        )}
        onError={() => {
          if (!isPlaceholder) setSrc(placeholder);
        }}
      />
    </div>
  );
}
