"use client";

/**
 * MatchTimeline — Figma 节点 5107:183082
 *
 * 比赛进行时间格栅：6 个等间距纵向 tick 线 + 中间横向分隔 + 顶部/底部标签行。
 * 不是"进度条"——是设计上的"时间格栅 + 中线"视觉。
 *
 * 顶部行：FCP (左, bold) · HT (中, opacity-80) · (2x45 Min) FT (右, opacity-80)
 * 底部行：NFO (左, bold) · 15' 30' 45' 60' 75' 90' (右侧均分, 45'/90' opacity-80, 其他 opacity-60)
 */

interface Props {
  startingAtTimestamp: number;
  /** 主队 short_code（左上 label） */
  homeShortCode?: string;
  /** 客队 short_code（左下 label） */
  awayShortCode?: string;
  status?: "upcoming" | "live" | "finished";
}

const TICKS: Array<{ label: string; emphasized: boolean }> = [
  { label: "15'", emphasized: false },
  { label: "30'", emphasized: false },
  { label: "45'", emphasized: true },
  { label: "60'", emphasized: false },
  { label: "75'", emphasized: false },
  { label: "90'", emphasized: true },
];

export default function MatchTimeline({
  startingAtTimestamp,
  homeShortCode = "HOM",
  awayShortCode = "AWA",
}: Props) {
  return (
    // 容器高 101px，底部一条 12% 白色分割线（Figma 5107:183082）
    <div
      className="relative h-[101px] w-full border-b border-[rgba(224,224,224,0.12)]"
      data-figma-node="5107:183082"
      data-starting-at={startingAtTimestamp}
    >
      {/* 顶部行：主队 short_code + HT + (2x45 Min) FT */}
      <div className="absolute left-[16px] right-[16px] top-[9px] flex items-center justify-between text-[10px] leading-[10px] text-[#e0e0e0]">
        <span className="font-bold leading-[12px]">{homeShortCode}</span>
        <span className="opacity-80">HT</span>
        <span className="opacity-80">(2x45 Min) FT</span>
      </div>

      {/* 中央 — 纵向 tick 格栅 SVG（imgGroup9 / 1022ba55e918a9...svg） */}
      {/* 高度 57px，左右内边距 16px，preserveAspectRatio=none 自适应宽度 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/match-detail/timeline-grid.svg"
        alt=""
        aria-hidden="true"
        className="block absolute left-[16px] right-[16px] top-[22px] h-[57px] w-[calc(100%-32px)]"
      />

      {/* 中线水平分隔 — y=50.5（与 SVG tick 中段 gap 对齐） */}
      <div className="absolute left-[16px] right-[16px] top-[49.5px] border-b border-[rgba(224,224,224,0.12)]" />

      {/* 底部行：客队 short_code + 6 个 tick 标签 */}
      <div className="absolute left-[16px] right-[16px] bottom-[8px] flex items-center text-[10px] leading-[10px] text-[#e0e0e0]">
        {/* NFO bold 左 */}
        <span className="font-bold leading-[12px] mr-auto">{awayShortCode}</span>
        {/* tick 标签：均分 6 列，宽度按 Figma inset 比例 */}
        <div className="flex items-center gap-0 w-[calc(100%-58px)] justify-between">
          {TICKS.map((t) => (
            <span key={t.label} className={t.emphasized ? "opacity-80" : "opacity-60"}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
