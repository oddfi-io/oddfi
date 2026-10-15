"use client";

/**
 * 代币分配结构（DD-146 B7）— Figma PC 8604:118227 / H5 8754:107684
 *
 * 环形 donut 图（纯 SVG stroke-dasharray），7 类分配图例卡片。
 * PC：donut 左侧（360×360）+ 图例右侧竖列
 * H5：donut 居中顶部（220×220）+ 图例全宽竖列
 * 文案走 i18n token.distribution.*（zh 中文 / 其余英文）；label 按 segments 数组下标对位。
 */

import { useTranslations } from "next-intl";

// ─── 分配数据（pct/配色以设计稿为准；label 走 i18n segments[i]） ───────────────
const SEGMENTS = [
  // 公平发售 — brand2-100 = #bcfcf1
  { pct: 30, colorClass: "bg-brand2-100", hex: "#bcfcf1" },
  // DEX 流动性 (LP) — brand2-300 = #6ff8e1
  { pct: 10, colorClass: "bg-brand2-300", hex: "#6ff8e1" },
  // 生态激励 — brand2-400 = #53f6db
  { pct: 15, colorClass: "bg-brand2-400", hex: "#53f6db" },
  // 庄家（做市）金库 — brand2-600 = #24debf
  { pct: 25, colorClass: "bg-brand2-600", hex: "#24debf" },
  // 生态/运营金库 — brand2-700 = #1cad95
  { pct: 20, colorClass: "bg-brand2-700", hex: "#1cad95" },
] as const;

// Total = 100 ✓ (30+10+15+25+20)

// ─── SVG Donut 构建工具 ──────────────────────────────────────────────────────
const GAP_DEG = 2.4; // 段间分隔角度（°）

/**
 * 将百分比角度转换为 SVG circle stroke-dasharray/dashoffset 参数。
 * SVG circle: cx/cy=center, r=radius, stroke-width=thickness
 * circumference = 2πr
 * dasharray = arcLen  gapLen
 * dashoffset 控制起始位置（12 点钟方向需旋转 -90deg 到 SVG）
 */
function buildDonutSegments(cx: number, cy: number, r: number) {
  const C = 2 * Math.PI * r; // 周长
  const totalGapDeg = GAP_DEG * SEGMENTS.length;
  const availableDeg = 360 - totalGapDeg;

  let currentDeg = 0; // 起始角度（从顶部算，-90° 修正在 SVG transform 里）

  return SEGMENTS.map((seg, i) => {
    const segDeg = (seg.pct / 100) * availableDeg;
    const dashLen = (segDeg / 360) * C;
    const gapLen = C - dashLen; // 剩余留白（包含 gap）
    // dashoffset：把当前段旋转到正确起始位置
    // 负 offset 使段从当前角度开始（SVG dashoffset 逆时针为负）
    const offsetDeg = currentDeg; // 从12点顺时针转
    const dashOffset = C * (1 - offsetDeg / 360);

    currentDeg += segDeg + GAP_DEG;

    return { ...seg, dashLen, gapLen, dashOffset, key: i };
  });
}

// ─── Donut SVG 组件 ──────────────────────────────────────────────────────────
function DonutChart({
  size,
  centerNum,
  centerSub,
}: {
  size: number;
  centerNum: string;
  centerSub: string;
}) {
  const strokeWidth = size * 0.167; // ~60px on 360, ~37px on 220
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const segments = buildDonutSegments(cx, cy, r);

  // center label font sizes
  const numSize = size >= 300 ? 40 : 24;
  const lblSize = size >= 300 ? 16 : 12;
  const numLH = size >= 300 ? 56 : 32;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {/* 背景轨道（深色圆环） */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        // @figma-hardcoded: #1a1c20 donut-track-bg — pending design token
        stroke="#1a1c20"
        strokeWidth={strokeWidth}
      />

      {/* 各段（从 12 点顺时针，旋转 -90° 修正 SVG 起点在 3 点） */}
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {segments.map((seg) => (
          <circle
            key={seg.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.hex}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dashLen} ${seg.gapLen}`}
            strokeDashoffset={seg.dashOffset}
            strokeLinecap="butt"
          />
        ))}
      </g>

      {/* 中心文字 */}
      <text
        x={cx}
        y={cy - numLH * 0.1}
        textAnchor="middle"
        dominantBaseline="middle"
        className="font-noto-sc font-bold"
        fontSize={numSize}
        // text-brand-default = #28f4d2
        fill="#28f4d2"
        letterSpacing="-0.8"
      >
        {centerNum}
      </text>
      <text
        x={cx}
        y={cy + numLH * 0.65}
        textAnchor="middle"
        dominantBaseline="middle"
        className="font-noto-sc"
        fontSize={lblSize}
        // @figma-hardcoded: rgba(255,255,255,0.5) donut-center-sub — pending design token
        fill="rgba(255,255,255,0.5)"
      >
        {centerSub}
      </text>
    </svg>
  );
}

// ─── 图例卡片 ────────────────────────────────────────────────────────────────
function LegendCard({
  label,
  pct,
  colorClass,
  variant,
}: {
  label: string;
  pct: number;
  colorClass: string;
  variant: "pc" | "h5";
}) {
  const isPc = variant === "pc";

  if (isPc) {
    // PC: 单行 「● 私募（3轮） · 15%」，卡片高 46px，圆角 12px
    return (
      <div className="flex h-[46px] w-full items-center rounded-[12px] border border-divider bg-secondary px-[14px]">
        <span className={`size-[14px] shrink-0 rounded-[7px] ${colorClass}`} aria-hidden="true" />
        <span className="font-noto-sc ml-[12px] text-[15px] font-normal leading-normal text-primary">
          {label} · {pct}%
        </span>
      </div>
    );
  }

  // H5: 两端对齐——左边「● 名称」，右边「加粗 15%」，卡片圆角 14px
  return (
    <div className="flex w-full items-center justify-between rounded-[14px] border border-divider bg-secondary px-4 py-[12px]">
      <div className="flex items-center gap-3">
        <span className={`size-3 shrink-0 rounded-full ${colorClass}`} aria-hidden="true" />
        <span className="font-noto-sc text-[14px] font-normal leading-5 text-primary">{label}</span>
      </div>
      <span className="font-noto-sc text-[14px] font-bold leading-5 text-brand-default">
        {pct}%
      </span>
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export default function TokenDistribution() {
  const t = useTranslations("token");
  const segLabels = t.raw("distribution.segments") as string[];
  const centerNum = t("distribution.centerNum");
  const centerSub = t("distribution.centerSub");
  return (
    <section data-figma-pc="8604:118227" data-figma-h5="8754:107684" className="w-full">
      {/* ───────── H5（< md）：垂直排列 ───────── */}
      <div className="flex flex-col items-start px-4 py-10 md:hidden">
        {/* 标题 */}
        <h2 className="font-noto-sc text-[26px] font-bold leading-[39px] text-primary">
          {t("distribution.title")}
        </h2>

        {/* 副标题 */}
        <p className="mt-2 font-noto-sc text-[14px] font-normal leading-[22.75px] text-secondary">
          {t("distribution.subtitle")}
        </p>

        {/* Donut 图居中 */}
        <div className="mt-6 flex w-full justify-center">
          <DonutChart size={220} centerNum={centerNum} centerSub={centerSub} />
        </div>

        {/* 图例列表 */}
        <div className="mt-6 flex w-full flex-col gap-2">
          {SEGMENTS.map((seg, i) => (
            <LegendCard key={i} {...seg} label={segLabels[i]} variant="h5" />
          ))}
        </div>
      </div>

      {/* ───────── PC（md+）：左 donut + 右图例 ───────── */}
      {/* mx-auto max-w-[1440px]：与 TokenMetrics/SaleSection 同一内容宽，标题/图形才能与全页对齐（宽屏不再飘） */}
      <div className="mx-auto hidden w-full max-w-[1440px] px-[130px] py-[111px] md:block">
        {/* 顶部标题区 */}
        <div className="mb-[65px]">
          <h2 className="font-noto-sc text-[44px] font-bold leading-[52px] text-primary">
            {t("distribution.title")}
          </h2>
          <p className="mt-2 font-noto-sc text-[16px] font-medium leading-[27px] text-secondary">
            {t("distribution.subtitle")}
          </p>
        </div>

        {/* 主体：donut 左对齐（Figma 距内容左 90px）+ 图例固定 310px 列，间距 181px，右侧自然留白 239px（对齐 Figma 8219:149300/152125） */}
        <div className="flex items-center gap-[181px] pl-[90px]">
          {/* Donut 图 */}
          <div className="shrink-0">
            <DonutChart size={360} centerNum={centerNum} centerSub={centerSub} />
          </div>

          {/* 图例：固定 310px 列（非拉伸） */}
          <div className="flex w-[310px] shrink-0 flex-col gap-[10px]">
            {SEGMENTS.map((seg, i) => (
              <LegendCard key={i} {...seg} label={segLabels[i]} variant="pc" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
