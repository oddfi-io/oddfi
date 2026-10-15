// DD-095 BracketScoreChip — 比分芯片（lg 152×64 / md 116×64）
// Figma 4676:135385（lg）/ 4676:135390（md）
// 占位态：足球 3d icon + Noto Sans SC Medium "???"
// 已晋级态：足球 + "X - Y" 比分（保留 score 显示逻辑）

import Image from "next/image";

interface BracketScoreChipProps {
  size: "lg" | "md";
  homeScore?: number;
  awayScore?: number;
}

export default function BracketScoreChip({ size, homeScore, awayScore }: BracketScoreChipProps) {
  const isLg = size === "lg";
  const containerClass = isLg
    ? "w-[152px] h-[64px] px-[20px] py-[16px]"
    : "w-[116px] h-[64px] px-[16px] py-[12px]";
  const iconSize = isLg ? 36 : 24;
  const textSize = isLg ? "text-[24px]" : "text-[18px]";

  const hasScore = homeScore !== undefined && awayScore !== undefined;
  const display = hasScore ? `${homeScore} - ${awayScore}` : "???";

  return (
    <div
      className={`${containerClass} flex items-center justify-center gap-[4px] rounded-[8px] bg-tertiary`}
    >
      <Image
        src="/images/sidebar/soccer.png"
        alt=""
        width={iconSize}
        height={iconSize}
        sizes={`${iconSize}px`}
        className="shrink-0 object-contain"
      />
      <span
        className={`${textSize} font-medium text-primary leading-none whitespace-nowrap`}
        style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
      >
        {display}
      </span>
    </div>
  );
}
