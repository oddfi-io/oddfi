"use client";

/**
 * 公平发售代币阶梯释放计划 —— Figma PC 8219:149571 / H5 8219:151353（DD-139）
 * DD-146 B7 复用：版式 + 释放模型（总量 3000 万 · 锁仓 10 天 · 29 天阶梯）与新设计稿
 *   8604:118694 / 8754:107940 一致，沿用既有 39 行确定性数据（前 10 天锁仓 0% 行可读性更完整）。
 *
 * 内容：
 *  ① 标题 + 释放规则摘要（前 10 天完全锁仓 · 释放期 29 天 6/21–7/19 · 首日 0.23% → 决赛日 6.67% · 累计 100%）
 *  ② PC 三张阶段卡片（锁仓期 / 释放初期 / 释放放量期）
 *  ③ 释放曲线：纯 SVG 面积图（accumulated release line + area fill）+ 柱状（当日释放量）
 *  ④ 逐日释放明细表（PC 5 列含累计进度条 / H5 4 列精简）
 *  ⑤ 免责声明脚注
 *
 * 数据：内联静态 `DEFAULT_ROWS`（39 天逐日累计释放%，前 10 天锁仓 0%，第 11–39 天阶梯递增到 100%）。
 *      props.rows 可选注入（后续接 lib/presale 真实数据），未注入用静态 default 独立渲染。
 *
 * Design Token：text-primary/secondary/tertiary · text-brand-default · bg-secondary / bg-fill-card1
 *   · border-divider · 薄荷色阶 brand2-*（面积图描边/填充渐变）。字体 font-noto-sc。
 *
 * 文案走 i18n token.unlock.*（zh 中文 / 其余英文）；D1–D29 等纯数字标签为语言中性保留内联。
 */

import { useTranslations } from "next-intl";
import { TOTAL_SALE_ODD } from "../config/tier-sale.config";

export interface UnlockRow {
  /** 第 N 天（从第 1 天起，前 10 天为锁仓期 0%） */
  day: number;
  /** 当日释放比例（%），锁仓期为 0 */
  dailyPct: number;
  /** 当日释放量（枚） */
  dailyAmount: number;
  /** 截至当日累计释放比例（%） */
  cumulativePct: number;
  /** 截至当日累计释放量（枚） */
  cumulativeAmount: number;
}

/** 总量 3000 万枚（复用发售总量 TOTAL_SALE_ODD），与设计稿末行 100% 对齐 */
const TOTAL_SUPPLY = TOTAL_SALE_ODD;
/** 释放期 29 天（第 11–39 天阶梯释放），前 10 天锁仓 */
const RELEASE_DAYS = 29;
/** 阶梯三角分母 1+2+…+29 = 435（当日释放量 = 总量 × k / 435） */
const RELEASE_DENOM = (RELEASE_DAYS * (RELEASE_DAYS + 1)) / 2;

/**
 * 派生完整 39 天行（前 10 天锁仓 0%，第 11–39 天阶梯释放），与 Figma 8219:149571 逐日表逐格一致。
 *
 * 设计稿口径（已核对 29 行）：
 *  - 当日释放量(枚) = round(总量 × k / 435)，k = day − 10（释放序号 1…29）
 *  - 累计释放量(枚) = 当日释放量滚动求和（非由百分比反推，故末行恰为 30,000,000）
 *  - 当日比例% = round(当日量 / 总量 × 100, 2)；累计比例% = round(累计量 / 总量 × 100, 2)
 *  末日 k=29：当日 2,000,000 / 6.67%、累计 30,000,000 / 100.00%。
 */
function buildRows(): UnlockRow[] {
  const rows: UnlockRow[] = [];
  let cumAmt = 0;
  for (let day = 1; day <= 39; day++) {
    const k = day - 10; // 释放序号（day11→1 … day39→29），锁仓期 k≤0
    const dailyAmount = day <= 10 ? 0 : Math.round((TOTAL_SUPPLY * k) / RELEASE_DENOM);
    cumAmt += dailyAmount;
    rows.push({
      day,
      dailyPct: Math.round((dailyAmount / TOTAL_SUPPLY) * 10000) / 100,
      dailyAmount,
      cumulativePct: Math.round((cumAmt / TOTAL_SUPPLY) * 10000) / 100,
      cumulativeAmount: cumAmt,
    });
  }
  return rows;
}

const DEFAULT_ROWS: UnlockRow[] = buildRows();

const fmtInt = (n: number) => n.toLocaleString("en-US");
/** 百分比保留 2 位（含尾随 0），用 toLocaleString 避开 no-restricted-syntax(toFixed)——纯展示非货币精度 */
const fmtPct = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─────────────────────────── 阶段说明卡片（PC） ─────────────────────────── */

/** 阶段卡 range 为语言中性（D1–D10 等），保留内联；title/desc 走 i18n unlock.phases[i]。 */
const PHASE_RANGES = ["D1–D10", "D11–D20", "D21–D29"] as const;

function PhaseCard({ range, title, desc }: { range: string; title: string; desc: string }) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-16 border border-divider bg-fill-card1 p-5">
      {/* 顶部薄荷高亮条 */}
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand2-400 to-transparent" />
      <p className="font-noto-sc text-[12px] leading-[18px] text-tertiary">{range}</p>
      <p className="mt-2 font-noto-sc text-[16px] font-bold leading-[24px] text-brand-default">
        {title}
      </p>
      <p className="mt-2 font-noto-sc text-[13px] leading-[20px] text-secondary">{desc}</p>
    </div>
  );
}

/* ─────────────────────────── 释放曲线（纯 SVG 双轴：柱状当日量 + 累计面积折线） ───────────────────────────
 * 对齐 Figma 8219:149607（设计稿为栅格图，按色彩/双轴/渐变还原）：
 *  - 柱状：靛蓝→青的纵向渐变（贯穿整个绘图高度，矮柱只露底部靛蓝、高柱露顶部青）
 *  - 折线/面积：青色累计释放%（右轴 0–100%）
 *  - 左轴当日释放量 0.0M–2.0M，右轴累计% 0–100%，轴文字走 HTML 侧栏与网格线对齐
 */

const Y_TICKS = 11; // 0,0.2M…2.0M / 0,10%…100%（11 档）
/** 当日释放量左轴满刻度 2.0M（= 末日当日释放量，设计稿口径） */
const MAX_DAILY = 2_000_000;

/** 释放序号 i(0-based) → X 轴标签 D1…D29（释放首日起相对天，对齐设计稿 8604:118932） */
function releaseDayLabel(i: number): string {
  return `D${i + 1}`;
}

function ReleaseChart({ rows }: { rows: UnlockRow[] }) {
  const t = useTranslations("token");
  // 仅释放期（跳过锁仓 0%，第 11–39 天，共 29 根柱）
  const release = rows.filter((r) => r.dailyAmount > 0);
  const n = release.length;

  // SVG 绘图区坐标系（坐标轴文字在 HTML 侧栏，故内部仅留极小 padding）
  const W = 900;
  const H = 360;
  const padT = 6;
  const padB = 4;
  const plotH = H - padT - padB;
  const x = (i: number) => (W * i) / (n - 1);
  const yCum = (pct: number) => padT + plotH * (1 - pct / 100);
  const yDaily = (amt: number) => padT + plotH * (1 - amt / MAX_DAILY);

  const linePts = release.map((r, i) => `${x(i)},${yCum(r.cumulativePct)}`);
  const linePath = `M ${linePts.join(" L ")}`;
  const areaPath = `M ${x(0)},${padT + plotH} L ${linePts.join(" L ")} L ${x(n - 1)},${padT + plotH} Z`;
  const barW = (W / n) * 0.58;

  // 轴刻度（自顶向下递减）+ 网格 %（自底向上 0→100）
  const leftAxis = Array.from(
    { length: Y_TICKS },
    (_, i) =>
      `${((Y_TICKS - 1 - i) * 0.2).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  );
  const rightAxis = Array.from({ length: Y_TICKS }, (_, i) => `${(Y_TICKS - 1 - i) * 10}%`);
  const gridYs = Array.from({ length: Y_TICKS }, (_, i) => i * 10);
  // H5 轴文字减半（每隔一格取，6 档：2.0M/1.6M/…/0.0M、100%/80%/…/0%）防拥挤
  const leftAxisH5 = leftAxis.filter((_, i) => i % 2 === 0);
  const rightAxisH5 = rightAxis.filter((_, i) => i % 2 === 0);

  return (
    // @figma-hardcoded: #08080b chart-panel-bg — pending design token（近黑绘图底）
    <div className="rounded-12 p-3 md:p-4" style={{ backgroundColor: "#08080b" }}>
      {/* 图例（顶部居中） */}
      <div className="mb-3 flex items-center justify-center gap-6">
        <span className="flex items-center gap-2 font-noto-sc text-[12px] leading-[18px] text-secondary">
          {/* @figma-hardcoded: #5b4ef5 当日释放柱靛蓝 — pending design token */}
          <span className="size-[10px] rounded-full" style={{ backgroundColor: "#5b4ef5" }} />
          {t("unlock.legendDaily")}
        </span>
        <span className="flex items-center gap-2 font-noto-sc text-[12px] leading-[18px] text-secondary">
          <span className="size-[10px] rounded-full bg-brand-default" />
          {t("unlock.legendCumulative")}
        </span>
      </div>

      {/* 主体：左轴 + 绘图区 + 右轴（justify-between 让 11 档与网格线对齐） */}
      <div className="flex items-stretch">
        {/* 左轴：H5 减半 6 档防拥挤，PC 全 11 档 */}
        <div className="flex flex-col justify-between py-[5px] pr-2 text-right font-noto-sc text-[10px] leading-none text-tertiary tabular-nums md:hidden">
          {leftAxisH5.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
        <div className="hidden flex-col justify-between py-[5px] pr-2 text-right font-noto-sc text-[10px] leading-none text-tertiary tabular-nums md:flex">
          {leftAxis.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-[120px] flex-1 md:h-[340px]"
          role="img"
          aria-label={t("unlock.chartAria")}
        >
          <defs>
            {/* 柱：青(顶)→靛蓝(底) 贯穿整个绘图高度（userSpaceOnUse，矮柱只露底部靛蓝） */}
            <linearGradient
              id="us-bar"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={padT}
              x2="0"
              y2={padT + plotH}
            >
              <stop offset="0%" stopColor="#2fe0e6" />
              <stop offset="55%" stopColor="#4a8bf5" />
              <stop offset="100%" stopColor="#5b3ff7" />
            </linearGradient>
            {/* 面积：青半透明 → 透明 */}
            <linearGradient id="us-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#28f4d2" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#28f4d2" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 横向网格线（0% 实线，余虚线） */}
          {gridYs.map((g) => (
            <line
              key={g}
              x1={0}
              x2={W}
              y1={yCum(g)}
              y2={yCum(g)}
              // @figma-hardcoded: #2a2c30 chart-grid — pending design token
              stroke="#2a2c30"
              strokeWidth={1}
              strokeDasharray={g === 0 ? "0" : "2 5"}
              opacity={g === 0 ? 0.9 : 0.5}
            />
          ))}

          {/* 当日释放量柱状（左轴 2.0M 满刻度） */}
          {release.map((r, i) => (
            <rect
              key={r.day}
              x={x(i) - barW / 2}
              y={yDaily(r.dailyAmount)}
              width={barW}
              height={padT + plotH - yDaily(r.dailyAmount)}
              rx={1.5}
              fill="url(#us-bar)"
            />
          ))}

          {/* 累计释放面积 + 折线（右轴 0–100%） */}
          <path d={areaPath} fill="url(#us-area)" />
          <path
            d={linePath}
            fill="none"
            stroke="#28f4d2"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {/* 末点高亮（100%） */}
          <circle cx={x(n - 1)} cy={yCum(100)} r={4.5} fill="#28f4d2" />
        </svg>

        {/* 右轴：H5 减半 6 档防拥挤，PC 全 11 档 */}
        <div className="flex flex-col justify-between py-[5px] pl-2 text-left font-noto-sc text-[10px] leading-none text-brand-default tabular-nums md:hidden">
          {rightAxisH5.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
        <div className="hidden flex-col justify-between py-[5px] pl-2 text-left font-noto-sc text-[10px] leading-none text-brand-default tabular-nums md:flex">
          {rightAxis.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>

      {/* X 轴 D1–D29（PC 全 29 天，末日 D29 高亮） */}
      <div className="mt-2 hidden justify-between font-noto-sc text-[9px] leading-none text-tertiary md:flex">
        {release.map((r, i) => (
          <span key={r.day} className={i === n - 1 ? "text-brand-default" : undefined}>
            {releaseDayLabel(i)}
          </span>
        ))}
      </div>
      <div className="mt-2 flex justify-between px-1 font-noto-sc text-[10px] leading-none text-tertiary md:hidden">
        <span>D1</span>
        <span>D8</span>
        <span>D15</span>
        <span>D22</span>
        <span className="text-brand-default">D29</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── 逐日释放明细表 ─────────────────────────── */

function ScheduleTable({ rows }: { rows: UnlockRow[] }) {
  const t = useTranslations("token");
  const headersPc = t.raw("unlock.headersPc") as string[];
  const headersH5 = t.raw("unlock.headersH5") as string[];
  // 释放行（跳过锁仓期 0%，与设计稿一致：第 11 天起）
  const releaseRows = rows.filter((r) => r.dailyPct > 0);
  return (
    <div className="overflow-hidden rounded-16 border border-divider bg-fill-card1">
      {/* PC：5 列含累计进度条 */}
      <table className="hidden w-full border-collapse font-noto-sc md:table">
        <thead>
          <tr className="border-b border-divider">
            {headersPc.map((h) => (
              <th
                key={h}
                className="px-5 py-3.5 text-left text-[12px] font-medium leading-[18px] text-tertiary"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {releaseRows.map((r, i) => {
            const last = i === releaseRows.length - 1;
            return (
              <tr
                key={r.day}
                className={`border-b border-divider/60 last:border-0 ${last ? "bg-brand2-50/[0.06]" : ""}`}
              >
                <td
                  className={`px-5 py-3 text-[13px] leading-[20px] ${last ? "font-bold text-brand-default" : "text-primary"}`}
                >
                  {t("unlock.dayLabelPc", { n: i + 1 })}
                </td>
                <td className="px-5 py-3 text-[13px] leading-[20px] text-secondary tabular-nums">
                  {fmtPct(r.dailyPct)}%
                </td>
                <td className="px-5 py-3 text-[13px] leading-[20px] text-secondary tabular-nums">
                  {fmtInt(r.dailyAmount)}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-[52px] text-[13px] leading-[20px] tabular-nums ${last ? "font-bold text-brand-default" : "text-secondary"}`}
                    >
                      {fmtPct(r.cumulativePct)}%
                    </span>
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-tertiary/30">
                      <span
                        className="block h-full rounded-full bg-brand-default"
                        style={{ width: `${r.cumulativePct}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td
                  className={`px-5 py-3 text-[13px] leading-[20px] tabular-nums ${last ? "font-bold text-brand-default" : "text-primary"}`}
                >
                  {fmtInt(r.cumulativeAmount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* H5：4 列精简（天数 / 当日释放% / 累计% / 累计代币）。固定高度内滚动（Figma 8219:151454：表头钉顶 + body 360px 滚动） */}
      <div className="max-h-[408px] overflow-y-auto md:hidden">
        <table className="w-full border-collapse font-noto-sc">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-divider">
              {headersH5.map((h) => (
                <th
                  key={h}
                  className="bg-fill-card1 px-4 py-3 text-left text-[12px] font-medium leading-[18px] text-tertiary first:text-left"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {releaseRows.map((r, i) => {
              const last = i === releaseRows.length - 1;
              return (
                <tr
                  key={r.day}
                  className={`border-b border-divider/60 last:border-0 ${last ? "bg-brand2-50/[0.06]" : ""}`}
                >
                  <td
                    className={`px-4 py-3 text-[13px] leading-[20px] ${last ? "font-bold text-brand-default" : "text-primary"}`}
                  >
                    {t("unlock.dayLabelH5", { n: i + 1 })}
                  </td>
                  <td className="px-4 py-3 text-[13px] leading-[20px] text-secondary tabular-nums">
                    {fmtPct(r.dailyPct)}%
                  </td>
                  <td
                    className={`px-4 py-3 text-[13px] leading-[20px] tabular-nums ${last ? "font-bold text-brand-default" : "text-secondary"}`}
                  >
                    {fmtPct(r.cumulativePct)}%
                  </td>
                  <td
                    className={`px-4 py-3 text-[13px] leading-[20px] tabular-nums ${last ? "font-bold text-brand-default" : "text-primary"}`}
                  >
                    {fmtInt(r.cumulativeAmount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────── 主组件 ─────────────────────────── */

export default function UnlockSchedule({ rows = DEFAULT_ROWS }: { rows?: UnlockRow[] }) {
  const t = useTranslations("token");
  const phases = t.raw("unlock.phases") as Array<{ title: string; desc: string }>;
  return (
    <section
      data-figma-pc="8219:149571"
      data-figma-h5="8219:151353"
      className="mx-auto w-full max-w-[1200px] px-4 py-10 md:px-8 md:py-16"
    >
      {/* 标题 + 规则摘要 */}
      <header className="mb-6 md:mb-8">
        <h2 className="font-noto-sc text-[24px] font-bold leading-[32px] text-primary md:text-[32px] md:leading-[40px]">
          {t("unlock.title")}
        </h2>
        <p className="mt-3 font-noto-sc text-[13px] leading-[22px] text-secondary md:text-[14px] md:leading-[20px]">
          {t("unlock.subtitlePre")} <span className="text-brand-default">→</span>{" "}
          {t("unlock.subtitlePost")}
        </p>
      </header>

      {/* 阶段卡片（PC 三列 / H5 纵向堆叠） */}
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:gap-4">
        {PHASE_RANGES.map((range, i) => (
          <PhaseCard key={range} range={range} title={phases[i].title} desc={phases[i].desc} />
        ))}
      </div>

      {/* 释放曲线（标题 + 趋势图同处一卡片容器，对齐 Figma 8219:149602） */}
      <div className="mb-8 rounded-16 border border-divider bg-fill-card1 p-4 md:p-6">
        <h3 className="font-noto-sc text-[18px] font-bold leading-[26px] text-primary md:text-[20px] md:leading-[28px]">
          {t("unlock.curveTitle")}
        </h3>
        <p className="mt-1 font-noto-sc text-[12px] leading-[18px] text-tertiary">
          {t("unlock.curveSubtitle")}
        </p>
        <div className="mt-4">
          <ReleaseChart rows={rows} />
        </div>
      </div>

      {/* 逐日释放表 */}
      <div>
        <h3 className="mb-4 font-noto-sc text-[18px] font-bold leading-[26px] text-primary">
          {t("unlock.tableTitle")}
        </h3>
        <ScheduleTable rows={rows} />
      </div>

      {/* 免责声明 */}
      <p className="mt-6 font-noto-sc text-[12px] leading-[20px] text-tertiary">
        <span className="text-brand-default">＊</span> {t("unlock.disclaimer")}
      </p>
    </section>
  );
}
