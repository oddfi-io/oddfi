// DD-095 BracketTreeDesktop — 单侧完整淘汰树（Figma 4580:6930 442×996 + 镜像 4676:136274）
// 6 段：80(R32) + 39(短连) + 84(R16) + 39(长连) + 84(QF) + 84(SF 列含上下 215 连接器 + cell)
// 连接线列内含多条 SVG H 桥，按 metadata 给定 y 绝对定位
// side="right" 用 flex-row-reverse 倒置列顺序 + connectorDir 反转开口方向
// SF 列严格按 Figma 4580:6928（左）/ 4676:135395（右）：
//   - 上连接器 39×215 at (22.5, 233)
//   - SF cell 84×64 at (0, 466)
//   - 下连接器 39×215 at (22.5, 763)

import type { GroupKey, TournamentBracket } from "@/lib/bracket/types";

import BracketConnector from "./BracketConnector";
import BracketKnockoutMatchCell from "./BracketKnockoutMatchCell";
import BracketRound32Column from "./BracketRound32Column";
import BracketTreeColumn from "./BracketTreeColumn";

interface BracketTreeDesktopProps {
  side: "left" | "right";
  bracket: TournamentBracket;
  onHoverStart?: (e: React.MouseEvent<HTMLDivElement>, groupKey: GroupKey) => void;
  onHoverEnd?: () => void;
}

// 短连接器（R32→R16）4 frame y 位置（Figma 4580:6924 内）
const SHORT_CONNECTOR_YS = [51.5, 306.5, 561.5, 816.5];
// 长连接器（R16→QF）2 frame y 位置（Figma 4580:6926 内）
const LONG_CONNECTOR_YS = [109, 631];

export default function BracketTreeDesktop({
  side,
  bracket,
  onHoverStart,
  onHoverEnd,
}: BracketTreeDesktopProps) {
  const r16Matches = bracket.matches.filter((m) => m.round === "r16");
  const qfMatches = bracket.matches.filter((m) => m.round === "qf");
  const sfMatches = bracket.matches.filter((m) => m.round === "sf");

  const r16Side = side === "left" ? r16Matches.slice(0, 4) : r16Matches.slice(4, 8);
  const qfSide = side === "left" ? qfMatches.slice(0, 2) : qfMatches.slice(2, 4);
  const sfMatch = side === "left" ? sfMatches[0] : sfMatches[1];
  const sfTeam = sfMatch?.homeTeamId ? (bracket.teams[sfMatch.homeTeamId] ?? null) : null;

  // side="right" 通过 flex-row-reverse 倒置列顺序 + connector 方向反转，
  // 不用 transform scaleX(-1)（会导致内部文字 / 国旗 / SVG 全部反向）
  const isRight = side === "right";
  const flexDir = isRight ? "flex-row-reverse" : "flex-row";
  const connectorDir: "right" | "left" = isRight ? "left" : "right";

  return (
    <div className={`flex ${flexDir} items-start gap-[8px] h-[996px] w-[442px] flex-shrink-0`}>
      {/* R32 列 80×996 */}
      <BracketRound32Column
        bracket={bracket}
        side={side === "left" ? "left" : "right"}
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
      />

      {/* R32 → R16 短连接器列 39×996（4 frame） */}
      <div className="relative w-[39px] h-[996px] flex-shrink-0">
        {SHORT_CONNECTOR_YS.map((y) => (
          <BracketConnector key={y} length="short" direction={connectorDir} top={y} />
        ))}
      </div>

      {/* R16 列 84×996 */}
      <BracketTreeColumn round="r16" matches={r16Side} bracket={bracket} />

      {/* R16 → QF 长连接器列 39×996（2 frame） */}
      <div className="relative w-[39px] h-[996px] flex-shrink-0">
        {LONG_CONNECTOR_YS.map((y) => (
          <BracketConnector key={y} length="long" direction={connectorDir} top={y} />
        ))}
      </div>

      {/* QF 列 84×996 */}
      <BracketTreeColumn round="qf" matches={qfSide} bracket={bracket} />

      {/* SF 列 84×996（Figma 4580:6928 左 / 4676:135395 右）— 严格按 metadata 三子节点定位
          注：下连接器 y 修正为对称布局（Figma 字面 y=763 与 SF cell 底端 530 有 233px 视觉断开，
          按"上连接器距 SF 顶 18px 间隙"对称推算下连接器 y=544 紧贴 SF cell 底端） */}
      <div className="relative w-[84px] h-[996px] flex-shrink-0">
        {/* 上连接器 4580:6919 / 4676:135396：(22.5, 233) 24×215 ┐ 形 — frame 底 y=448 ≈ SF 顶 466 */}
        <div className="absolute" style={{ left: 22.5, top: 233 }}>
          <BracketConnector length="xlong" direction={connectorDir} cap="top" />
        </div>
        {/* SF cell 4652:17808 / 4676:135398：(0, 466) 84×64 */}
        <div className="absolute" style={{ left: 0, top: 466 }}>
          <BracketKnockoutMatchCell team={sfTeam} width={84} height={64} />
        </div>
        {/* 下连接器 ┘ 形 — frame 顶 y=544 紧贴 SF cell 底 530（18px 对称间隙），frame 底 y=759 ≈ QF 下中线 */}
        <div className="absolute" style={{ left: 22.5, top: 544 }}>
          <BracketConnector length="xlong" direction={connectorDir} cap="bottom" />
        </div>
      </div>
    </div>
  );
}
