// DD-095 BracketFinalCell — 决赛 VS cell
// Figma 节点：4676:135191 — 174×56 px-24 py-12 rounded-[16.242] bg-tertiary
// 内容：足球 32 + VS 24 + 足球 32（**无大力神杯** — 按设计 4652:6736）

import Image from "next/image";

import type { BracketMatch, BracketTeam } from "@/lib/bracket/types";

interface BracketFinalCellProps {
  match: BracketMatch;
  teams: Record<string, BracketTeam>;
}

const SOCCER_BALL = "/banner/icons/soccer-ball.png";

export default function BracketFinalCell({ match, teams }: BracketFinalCellProps) {
  // 当前 mock 决赛是 stub TBD；保留 home / away 计算以便后续接入真实数据
  // 视觉上 Figma 4652:6736 决赛 cell 显示足球占位（不显示国旗）
  void match;
  void teams;

  return (
    <div className="flex items-center justify-center gap-[16px] w-[174px] px-[24px] py-[12px] rounded-[16.242px] bg-tertiary">
      <Image
        src={SOCCER_BALL}
        alt="home"
        width={32}
        height={32}
        sizes="32px"
        className="size-[32px] object-contain shrink-0"
      />
      <span className="text-[24px] font-medium text-primary leading-none">VS</span>
      <Image
        src={SOCCER_BALL}
        alt="away"
        width={32}
        height={32}
        sizes="32px"
        className="size-[32px] object-contain shrink-0"
      />
    </div>
  );
}
