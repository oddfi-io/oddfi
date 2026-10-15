// DD-095 BracketChampionCenter — 冠军中心栏（标题 → 足球??? → Trophy）
// Figma 整页 4474:166853 中央列精确坐标：
//   WC 标题 y=128, chip lg y=209, trophy y=464
//   → WC→chip 41px / chip→trophy 191px (191 = 464-273)

import Image from "next/image";

import BracketScoreChip from "@/components/bracket/BracketScoreChip";
import type { BracketMatch } from "@/lib/bracket/types";

interface BracketChampionCenterProps {
  finalMatch?: BracketMatch;
}

export default function BracketChampionCenter({ finalMatch }: BracketChampionCenterProps) {
  return (
    <div className="flex flex-col items-center">
      {/* 标题 420×40 */}
      <div
        className="w-[420px] h-[40px] flex items-center justify-center text-[36px] leading-[40px] font-black text-white whitespace-nowrap mb-[41px]"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
      >
        WORLD CHAMPIONS
      </div>

      {/* 比分芯片（trophy 上方，决赛对决占位） — Figma 间距 chip→trophy = 191px */}
      <BracketScoreChip
        size="lg"
        homeScore={finalMatch?.homeScore}
        awayScore={finalMatch?.awayScore}
      />

      {/* Trophy 立绘 139.55×342 */}
      <Image
        src="/images/bracket/trophy.png"
        alt="World Cup Trophy"
        width={140}
        height={342}
        sizes="140px"
        className="object-contain mt-[191px]"
      />
    </div>
  );
}
