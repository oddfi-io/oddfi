// DD-095 BracketBronzeWinner — 季军区
// Figma 4652:6724（标题区）+ 4676:135390（md 比分芯片）
// "BRONZE WINNER" 标题 237×30 + BracketScoreChip md

import BracketScoreChip from "@/components/bracket/BracketScoreChip";
import type { BracketMatch } from "@/lib/bracket/types";

interface BracketBronzeWinnerProps {
  bronzeMatch?: BracketMatch;
}

export default function BracketBronzeWinner({ bronzeMatch }: BracketBronzeWinnerProps) {
  return (
    // Figma 整页坐标：BRONZE WINNER y=936, chip md y=997 → 间距 31px
    <div className="flex flex-col items-center gap-[31px]">
      {/* 标题 237×30（Figma 4652:6724 — Orbitron Bold 24 / white） */}
      <div
        className="w-[237px] h-[30px] flex items-center justify-center text-[24px] font-bold text-white whitespace-nowrap"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
      >
        BRONZE WINNER
      </div>

      {/* 比分芯片 md */}
      <BracketScoreChip
        size="md"
        homeScore={bronzeMatch?.homeScore}
        awayScore={bronzeMatch?.awayScore}
      />
    </div>
  );
}
