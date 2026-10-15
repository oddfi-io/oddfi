// DD-095 BracketTreeMobile — H5 垂直淘汰赛树（Figma 4652:6736 像素级还原）
//
// 结构（上半段 → 决赛 → 下半段镜像）：
//   R32 行 1 (4 cells, 白底)
//   R32 行 2 (4 cells, 白底)
//   ─ 横向桥接 frame (R32→R16, h25) ─
//   R16 (4 cells, 黑底)
//   ─ 横向桥接 frame (R16→QF, h40) ─
//   QF (2 cells w-107 居中 gap-75)
//   ─ 竖线 60px ─
//   SF (1 cell w-107)
//   ─ 竖线 60px ─
//   WORLD CHAMPIONS 标题
//   Final cell (足球 vs 足球)
//   ─ 镜像下半段 ─

import { MOCK_BRACKET } from "@/lib/bracket/mock-data";
import type { BracketMatch, BracketTeam } from "@/lib/bracket/types";

import BracketFinalCell from "./BracketFinalCell";
import BracketQfSfCell from "./BracketQfSfCell";
import BracketRoundRow from "./BracketRoundRow";

// 桥接连接器统一描边色（Figma frame 2087328086 / 2087328074 / 2087328076）
const STROKE = "#8B8D93";

function VerticalLine({ height }: { height: number }) {
  return <div aria-hidden className="w-[1px] bg-[#8B8D93]" style={{ height: `${height}px` }} />;
}

// R32 ↔ R16 桥接（Figma frame 2087328086, h=25）：4 条与 cell 中心对齐的竖线
// 用 4-列 flex-1 + gap-16 layout 与上方 R32/R16 row 共用 flex 计算 → 1px 竖线必落 cell 中心
function BridgeR32R16() {
  return (
    <div aria-hidden className="flex w-full h-[25px] gap-[16px]">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex-1 flex items-center justify-center">
          <div className="w-[1px] h-full" style={{ backgroundColor: STROKE }} />
        </div>
      ))}
    </div>
  );
}

// R16 ↔ QF 桥接（Figma frame 2087328074, h=40）：2 个"凹"形 U 合并器
// 每个 U：从 2 个 R16 cell 中心向下延伸 17px → 4px radius 圆角 → 横向汇合 → 4px 圆角 → 上行
// 底部中心向下出 1 条线（19px）连到下方 QF cell 中心
function BridgeR16Qf({ flipped = false }: { flipped?: boolean }) {
  return (
    <div
      aria-hidden
      className={["flex w-full h-[40px] gap-[16px]", flipped ? "rotate-180" : ""].join(" ")}
    >
      {[0, 1].map((i) => (
        <div key={i} className="flex-1">
          <svg className="w-full h-full" viewBox="0 0 90 40" preserveAspectRatio="none" fill="none">
            <path
              d="M0.5 0 V17 C0.5 19.2091 2.29086 21 4.5 21 H85.5 C87.7091 21 89.5 19.2091 89.5 17 V0"
              stroke={STROKE}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="46"
              y1="21"
              x2="46"
              y2="40"
              stroke={STROKE}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

// QF ↔ SF 桥接（Figma frame 2087328076, viewBox 343×40）：1 个更宽的 U 合并器
// QF 行（justify-center gap-75 cells w-107 在 343 wide bracket）→ QF cell 中心 80.5 / 262.5
// SF cell 中心 = 343/2 = 171.5（justify-center w-107）→ U 底部 drop 落 SF 中心
function BridgeQfSf({ flipped = false }: { flipped?: boolean }) {
  return (
    <div aria-hidden className={["w-full h-[40px]", flipped ? "rotate-180" : ""].join(" ")}>
      <svg className="w-full h-full" viewBox="0 0 343 40" preserveAspectRatio="none" fill="none">
        <path
          d="M80.5 0 V17 C80.5 19.2091 82.2909 21 84.5 21 H258.5 C260.709 21 262.5 19.2091 262.5 17 V0"
          stroke={STROKE}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="171.5"
          y1="21"
          x2="171.5"
          y2="40"
          stroke={STROKE}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

interface QfSfRowProps {
  matches: BracketMatch[];
  teams: Record<string, BracketTeam>;
  variant: "qf" | "sf";
}

function QfSfRow({ matches, teams, variant }: QfSfRowProps) {
  if (variant === "sf") {
    const m = matches[0];
    if (!m) return null;
    return (
      <div className="flex items-center justify-center w-full">
        <BracketQfSfCell match={m} teams={teams} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-[75px] w-full">
      {matches.map((m) => (
        <BracketQfSfCell key={m.id} match={m} teams={teams} />
      ))}
    </div>
  );
}

export default function BracketTreeMobile() {
  const { teams, matches } = MOCK_BRACKET;

  const r32 = matches.filter((m) => m.round === "r32");
  const r16 = matches.filter((m) => m.round === "r16");
  const qf = matches.filter((m) => m.round === "qf");
  const sf = matches.filter((m) => m.round === "sf");
  const final = matches.filter((m) => m.round === "final");

  // 上半段切片
  const r32Top1 = r32.slice(0, 4);
  const r32Top2 = r32.slice(4, 8);
  const r16Top = r16.slice(0, 4);
  const qfTop = qf.slice(0, 2);
  const sfTop = sf.slice(0, 1);

  // 下半段切片（镜像）
  const r32Bot1 = r32.slice(8, 12);
  const r32Bot2 = r32.slice(12, 16);
  const r16Bot = r16.slice(4, 8);
  const qfBot = qf.slice(2, 4);
  const sfBot = sf.slice(1, 2);

  const finalMatch = final[0] ?? null;

  return (
    <div className="flex flex-col items-center w-full px-[16px] pb-[env(safe-area-inset-bottom)]">
      {/* === 上半段 === */}
      <BracketRoundRow round="r32" matches={r32Top1} teams={teams} />
      <div className="h-[16px]" aria-hidden />
      <BracketRoundRow round="r32" matches={r32Top2} teams={teams} />

      <div className="h-[11px]" aria-hidden />
      <BridgeR32R16 />

      <div className="h-[8px]" aria-hidden />
      <BracketRoundRow round="r16" matches={r16Top} teams={teams} />

      <div className="h-[18px]" aria-hidden />
      <BridgeR16Qf />

      <div className="h-[12px]" aria-hidden />
      <QfSfRow matches={qfTop} teams={teams} variant="qf" />

      <div className="h-[13px]" aria-hidden />
      <BridgeQfSf />
      <div className="h-[11px]" aria-hidden />

      <QfSfRow matches={sfTop} teams={teams} variant="sf" />

      <div className="h-[16px]" aria-hidden />
      <VerticalLine height={60} />

      {/* WORLD CHAMPIONS 标题 — 20px Orbitron Black */}
      <div className="h-[16px]" aria-hidden />
      <h2
        className="text-[20px] font-black tracking-[0.04em] text-primary whitespace-nowrap leading-[25.333px]"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
      >
        WORLD CHAMPIONS
      </h2>

      <div className="h-[16px]" aria-hidden />
      {finalMatch && <BracketFinalCell match={finalMatch} teams={teams} />}

      {/* === 下半段（镜像，元素顺序反转） === */}
      <div className="h-[16px]" aria-hidden />
      <VerticalLine height={60} />

      <div className="h-[16px]" aria-hidden />
      <QfSfRow matches={sfBot} teams={teams} variant="sf" />

      <div className="h-[11px]" aria-hidden />
      <BridgeQfSf flipped />
      <div className="h-[13px]" aria-hidden />

      <QfSfRow matches={qfBot} teams={teams} variant="qf" />

      <div className="h-[12px]" aria-hidden />
      <BridgeR16Qf flipped />
      <div className="h-[18px]" aria-hidden />

      <BracketRoundRow round="r16" matches={r16Bot} teams={teams} />

      <div className="h-[8px]" aria-hidden />
      <BridgeR32R16 />
      <div className="h-[11px]" aria-hidden />

      <BracketRoundRow round="r32" matches={r32Bot1} teams={teams} />
      <div className="h-[16px]" aria-hidden />
      <BracketRoundRow round="r32" matches={r32Bot2} teams={teams} />
    </div>
  );
}
