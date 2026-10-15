// DD-095 BracketTreeColumn — R16/QF/SF 淘汰轮列（Figma 4580:6925/6927）
// 每场比赛渲染 2 个 BracketKnockoutMatchCell（home + away），cell 间 gap 7（QF 同），SF cell 64 高
// absolute 布局：按 metadata 给的 frame y/height 精确还原

import { MOCK_BRACKET } from "@/lib/bracket/mock-data";
import type { BracketMatch, TournamentBracket } from "@/lib/bracket/types";

import BracketKnockoutMatchCell from "./BracketKnockoutMatchCell";

interface BracketTreeColumnProps {
  round: "r16" | "qf" | "sf";
  matches: BracketMatch[];
  bracket?: TournamentBracket;
  /** 兼容旧调用 — 当前组件未使用，保留以避免 TreeDesktop 编译错误 */
  direction?: "right" | "left";
}

// 每 frame 由 metadata 给定 y 起始 + frame 高度（含 home+away cell + 7px 内 gap）
const FRAME_LAYOUT: Record<
  "r16" | "qf" | "sf",
  { y: number; frameHeight: number; cellHeight: number }[]
> = {
  r16: [
    { y: 55.5, frameHeight: 106, cellHeight: 49 },
    { y: 314.5, frameHeight: 106, cellHeight: 49 },
    { y: 573.5, frameHeight: 106, cellHeight: 49 },
    { y: 832.5, frameHeight: 108, cellHeight: 50 },
  ],
  qf: [
    { y: 184, frameHeight: 106, cellHeight: 49 },
    { y: 706, frameHeight: 106, cellHeight: 49 },
  ],
  sf: [
    { y: 466, frameHeight: 64, cellHeight: 64 }, // SF 单 cell（无 home/away pair）
  ],
};

export default function BracketTreeColumn({
  round,
  matches,
  bracket = MOCK_BRACKET,
}: BracketTreeColumnProps) {
  const layout = FRAME_LAYOUT[round];

  return (
    <div className="relative w-[84px] h-[996px] flex-shrink-0">
      {matches.map((match, idx) => {
        const slot = layout[idx];
        if (!slot) return null;

        const homeTeam = match.homeTeamId ? (bracket.teams[match.homeTeamId] ?? null) : null;
        const awayTeam = match.awayTeamId ? (bracket.teams[match.awayTeamId] ?? null) : null;

        // SF: 单 cell（仅渲染晋级队，没有 home/away 对）
        if (round === "sf") {
          return (
            <div key={match.id} className="absolute left-0 w-[84px]" style={{ top: slot.y }}>
              <BracketKnockoutMatchCell
                team={homeTeam ?? awayTeam}
                width={84}
                height={slot.cellHeight}
              />
            </div>
          );
        }

        // R16 / QF: home + away pair，cell 间 gap = frameHeight - 2*cellHeight
        const gap = slot.frameHeight - slot.cellHeight * 2;
        return (
          <div
            key={match.id}
            className="absolute left-0 w-[84px] flex flex-col"
            style={{ top: slot.y, gap }}
          >
            <BracketKnockoutMatchCell team={homeTeam} width={84} height={slot.cellHeight} />
            <BracketKnockoutMatchCell team={awayTeam} width={84} height={slot.cellHeight} />
          </div>
        );
      })}
    </div>
  );
}
