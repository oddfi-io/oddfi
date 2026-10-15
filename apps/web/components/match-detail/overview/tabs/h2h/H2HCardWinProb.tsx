"use client";

/**
 * H2HCardWinProb — H2H 1/3 卡片，Figma 5107:183025+
 *
 * 双区块：
 *   - WIN PROBABILITY：42% / 31% / 27%（主队/平/客队），三色比例条
 *   - PREVIOUS MEETINGS：0 / 0 / 1 wins，按比例条
 */

import type { WinProbability, H2HSummary } from "@/types/match-detail-domain";
import { HOME_BLUE as HOME_COLOR, AWAY_ORANGE as AWAY_COLOR } from "@/lib/match-colors";

type Tone = "home" | "away" | "draw";

interface H2HCardWinProbProps {
  winProbability: WinProbability | null;
  /**
   * null 表示 overview 数据未就绪或后端未返回该字段。
   * Previous Meetings 区块三个数字显示 '—'。
   */
  h2hSummary: H2HSummary | null;
  homeShortCode: string;
  awayShortCode: string;
}

const TONE_NUM_HEX: Record<Tone, string | undefined> = {
  home: HOME_COLOR,
  away: AWAY_COLOR,
  draw: undefined,
};
const TONE_LABEL_CLASS: Record<Tone, string> = {
  home: "",
  away: "",
  draw: "text-tertiary",
};

function PctCell({
  value,
  label,
  align,
  big,
  tone,
}: {
  value: number | string;
  label: string;
  align: "left" | "center" | "right";
  big: boolean;
  tone: Tone;
}) {
  // 紧凑模式（市场页详情列 140px 容器内 sub-header 占 22+4=26px, 余 114px 给本卡）
  const numSize = big ? "text-[18px] leading-none" : "text-[14px] leading-none";
  const pctSize = big ? "text-[14px] leading-none" : "text-[11px] leading-none";
  const alignClass =
    align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center";
  const justifyClass =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const hex = TONE_NUM_HEX[tone];
  const numColorClass = hex ? "" : "text-secondary";

  return (
    <div className={`flex flex-col ${alignClass}`}>
      <div
        className={`flex items-baseline ${justifyClass} ${numColorClass}`}
        style={hex ? { color: hex } : undefined}
      >
        <span className={`${numSize} font-medium`}>{value}</span>
        <span className={`${pctSize} font-light`}>%</span>
      </div>
      <span
        className={`mt-[1px] text-[10px] leading-none uppercase ${TONE_LABEL_CLASS[tone]}`}
        style={hex ? { color: hex } : undefined}
      >
        {label}
      </span>
    </div>
  );
}

/** 三段比例条：home/draw/away，draw 中段半高。draw 用 Token bg-tertiary (#5C5D61) 替代旧 hex */
function ProportionBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  const total = home + draw + away;
  const hPct = total > 0 ? (home / total) * 100 : 0;
  const dPct = total > 0 ? (draw / total) * 100 : 0;
  const aPct = total > 0 ? (away / total) * 100 : 0;

  return (
    <div className="relative h-[8px] w-full overflow-hidden rounded-[2px]">
      {/* home 全高 */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: `${hPct}%`, backgroundColor: HOME_COLOR }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 h-[4px] bg-tertiary"
        style={{ left: `${hPct}%`, width: `${dPct}%` }}
      />
      {/* away 全高 */}
      <div
        className="absolute right-0 top-0 bottom-0"
        style={{ width: `${aPct}%`, backgroundColor: AWAY_COLOR }}
      />
    </div>
  );
}

export function H2HCardWinProb({
  winProbability,
  h2hSummary,
  homeShortCode,
  awayShortCode,
}: H2HCardWinProbProps) {
  const prob = winProbability ?? { home: 33, draw: 34, away: 33 };

  return (
    <div className="px-[8px] flex flex-col gap-[6px]" data-figma-node="5107:183025">
      <section className="flex flex-col gap-[3px]">
        <p className="text-[10px] leading-none uppercase text-secondary text-center font-medium tracking-wide">
          Win Probability
        </p>
        <div className="flex items-end justify-between">
          <PctCell value={prob.home} label={homeShortCode} align="left" big tone="home" />
          <PctCell value={prob.draw} label="Draw" align="center" big={false} tone="draw" />
          <PctCell value={prob.away} label={awayShortCode} align="right" big tone="away" />
        </div>
        <ProportionBar home={prob.home} draw={prob.draw} away={prob.away} />
      </section>

      <section className="flex flex-col gap-[3px]">
        <p className="text-[10px] leading-none uppercase text-secondary text-center font-medium tracking-wide">
          Previous Meetings
        </p>
        <div className="flex items-end justify-between">
          <div className="flex flex-col items-start" style={{ color: HOME_COLOR }}>
            <span className="text-[18px] leading-[21px] font-medium">
              {h2hSummary != null ? h2hSummary.home_wins : "—"}
            </span>
            <span className="mt-[2px] text-[10px] leading-[10px] uppercase">Wins</span>
          </div>
          <div className="flex flex-col items-center text-secondary">
            <span className="text-[14px] leading-none font-medium">
              {h2hSummary != null ? h2hSummary.draws : "—"}
            </span>
            <span className="mt-[1px] text-[9px] leading-none uppercase text-tertiary">Draws</span>
          </div>
          <div className="flex flex-col items-end" style={{ color: AWAY_COLOR }}>
            <span className="text-[18px] leading-[21px] font-medium">
              {h2hSummary != null ? h2hSummary.away_wins : "—"}
            </span>
            <span className="mt-[2px] text-[10px] leading-[10px] uppercase">Wins</span>
          </div>
        </div>
        {h2hSummary != null && (
          <ProportionBar
            home={h2hSummary.home_wins}
            draw={h2hSummary.draws}
            away={h2hSummary.away_wins}
          />
        )}
      </section>
    </div>
  );
}
