"use client";

/**
 * MoneylineChart — Moneyline 趋势折线图（三条线：home / draw / away）。
 *
 * Figma 节点：5107:182751 / 5107:182636
 * 实现：lightweight-charts v5 dynamic import + 实例复用（ENH-031 B1.3）。
 *   - 一次 createChart + 一次 addSeries + 一次 subscribeCrosshairMove（mount-only effect）
 *   - trend 变化 → 仅 series.setData，不重建 chart（消除每 30/60s 销毁重建造成的闪烁）
 *   - colors / height 变化 → 各自局部 applyOptions / resize
 *   - cleanup 显式 chart.unsubscribeCrosshairMove(handler)（B1.1），消除 lightweight-charts v5
 *     `remove()` 不解除回调闭包对 series 的引用所导致的内存泄露
 * 切赛事时父级以 key={fixture.id} 隔离实例，避免旧 chart 持续接收新数据。
 */

import { memo, useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from "lightweight-charts";
import type { MoneylineTrend } from "@/types/moneyline";

interface TooltipData {
  visible: boolean;
  x: number;
  y: number;
  time: string;
  homePct: number | null;
  drawPct: number | null;
  awayPct: number | null;
}

interface Props {
  trend: MoneylineTrend;
  height?: number;
  homeColor: string;
  drawColor: string;
  awayColor: string;
  homeName: string;
  awayName: string;
}

/** ISO 8601 timestamp → lightweight-charts UTCTimestamp (seconds) */
function toUtcSeconds(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

/** Format UTC seconds for tooltip display */
function formatTooltipTime(utcSec: number): string {
  const d = new Date(utcSec * 1000);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** xx:xx AM/PM 时间格式（用于 X 轴 HTML 标签） */
function formatAxisTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * 右侧价格轴宽度，用于对齐 X 轴 HTML 标签。
 * Figma 6123:95149 实测 100% 标签节点宽 ~28px，留 4px 缓冲 = 32。
 */
const PRICE_SCALE_WIDTH = 32;

/** Figma 6123:95149 X 轴展示 5 个均匀分布时间标签（数据点过多时密集挤压会变乱码）。 */
const AXIS_TICK_COUNT = 5;

/** 从数据序列均匀采样 n 个元素（首尾必含）。 */
function pickEvenTicks<T>(arr: readonly T[], n: number): T[] {
  if (arr.length <= n) return [...arr];
  if (n <= 1) return arr.length > 0 ? [arr[0]!] : [];
  const last = arr.length - 1;
  return Array.from({ length: n }, (_, i) => arr[Math.round((i / (n - 1)) * last)]!);
}

function MoneylineChart({
  trend,
  height = 160,
  homeColor,
  drawColor,
  awayColor,
  homeName,
  awayName,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const homeSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const drawSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const awaySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const handlerRef = useRef<((param: MouseEventParams<Time>) => void) | null>(null);
  // 首次有数据时 fitContent 一次；之后依靠 fixLeftEdge/fixRightEdge 自动吸边
  const didFitContentRef = useRef(false);
  // 让 mount-only effect 取最新 props 而不进入依赖数组（chart 实例只创建一次）
  const initialColorsRef = useRef({ homeColor, drawColor, awayColor });
  initialColorsRef.current = { homeColor, drawColor, awayColor };
  const initialHeightRef = useRef(height);
  initialHeightRef.current = height;

  const [ready, setReady] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipData>({
    visible: false,
    x: 0,
    y: 0,
    time: "",
    homePct: null,
    drawPct: null,
    awayPct: null,
  });

  // ── Mount-only effect：createChart + addSeries + subscribeCrosshairMove（一次）
  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    async function init() {
      // lightweight-charts v5 is ESM-only — must use dynamic import()
      const { createChart, LineSeries, ColorType } = await import("lightweight-charts");
      if (cancelled || !container) return;

      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#5c5d61",
          fontSize: 11,
          attributionLogo: false,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: "rgba(255,255,255,0.06)", visible: true },
        },
        crosshair: {
          vertLine: {
            color: "rgba(255,255,255,0.2)",
            labelVisible: false,
          },
          horzLine: { visible: false, labelVisible: false },
        },
        rightPriceScale: {
          borderVisible: false,
          textColor: "#5c5d61",
          scaleMargins: { top: 0.05, bottom: 0.05 },
          minimumWidth: PRICE_SCALE_WIDTH,
          entireTextOnly: true,
        },
        timeScale: {
          // 隐藏内置时间轴，下方用 HTML 标签自渲染（统一字重）
          visible: false,
          borderVisible: false,
          // 折线左右两端贴边 —— 对齐 Figma 6123:95149 的折线占满有效区。
          fixLeftEdge: true,
          fixRightEdge: true,
          rightOffset: 0,
          lockVisibleTimeRangeOnResize: true,
        },
        width: container.clientWidth,
        height: initialHeightRef.current,
        handleScroll: false,
        handleScale: false,
      });

      const commonSeriesOptions = {
        lineWidth: 2 as const,
        lastValueVisible: false,
        priceLineVisible: false,
        priceFormat: {
          type: "custom" as const,
          formatter: (price: number) => (Number.isFinite(price) ? `${Math.round(price)}%` : ""),
          minMove: 1,
        },
        // 强制 Y 轴 0%-100% 固定范围
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: 0, maxValue: 100 },
        }),
      };

      const { homeColor: hC, drawColor: dC, awayColor: aC } = initialColorsRef.current;
      const homeSeries = chart.addSeries(LineSeries, { ...commonSeriesOptions, color: hC });
      const drawSeries = chart.addSeries(LineSeries, { ...commonSeriesOptions, color: dC });
      const awaySeries = chart.addSeries(LineSeries, { ...commonSeriesOptions, color: aC });

      // Crosshair hover → show tooltip。handler 只读 series ref + setTooltip，
      // 不依赖 homeName/awayName/colors（这些走 JSX/colors effect），mount 一次即可。
      const handler = (param: MouseEventParams<Time>) => {
        const hs = homeSeriesRef.current;
        const ds = drawSeriesRef.current;
        const as = awaySeriesRef.current;
        const cw = containerRef.current?.clientWidth ?? 0;

        if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
          setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
          return;
        }

        const homeVal = hs && (param.seriesData.get(hs) as { value?: number } | undefined)?.value;
        const drawVal = ds && (param.seriesData.get(ds) as { value?: number } | undefined)?.value;
        const awayVal = as && (param.seriesData.get(as) as { value?: number } | undefined)?.value;

        const homeOut = typeof homeVal === "number" ? homeVal : null;
        const drawOut = typeof drawVal === "number" ? drawVal : null;
        const awayOut = typeof awayVal === "number" ? awayVal : null;

        if (homeOut === null && drawOut === null && awayOut === null) {
          setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
          return;
        }

        setTooltip({
          visible: true,
          x: Math.min(param.point.x + 12, Math.max(cw - 160, 0)),
          y: Math.max(param.point.y - 40, 4),
          time: formatTooltipTime(param.time as number),
          homePct: homeOut !== null ? Math.round(homeOut) : null,
          drawPct: drawOut !== null ? Math.round(drawOut) : null,
          awayPct: awayOut !== null ? Math.round(awayOut) : null,
        });
      };
      chart.subscribeCrosshairMove(handler);

      chartRef.current = chart;
      homeSeriesRef.current = homeSeries;
      drawSeriesRef.current = drawSeries;
      awaySeriesRef.current = awaySeries;
      handlerRef.current = handler;
      setReady(true);
    }

    init();

    return () => {
      cancelled = true;
      const chart = chartRef.current;
      const handler = handlerRef.current;
      // B1.1：cleanup 必须显式 unsubscribe；remove() 不会解除回调对 series 的闭包引用。
      if (chart && handler) {
        chart.unsubscribeCrosshairMove(handler);
      }
      chart?.remove();
      chartRef.current = null;
      homeSeriesRef.current = null;
      drawSeriesRef.current = null;
      awaySeriesRef.current = null;
      handlerRef.current = null;
      didFitContentRef.current = false;
    };
  }, []);

  // ── Data effect：trend 变化只 setData，不重建 chart（消除每 poll 一次的闪烁）
  useEffect(() => {
    if (!ready) return;
    const hs = homeSeriesRef.current;
    const ds = drawSeriesRef.current;
    const as = awaySeriesRef.current;
    const chart = chartRef.current;
    if (!hs || !ds || !as || !chart) return;

    const homeData = trend.home.map((p) => ({
      time: toUtcSeconds(p.time) as never,
      value: p.value,
    }));
    const drawData = trend.draw.map((p) => ({
      time: toUtcSeconds(p.time) as never,
      value: p.value,
    }));
    const awayData = trend.away.map((p) => ({
      time: toUtcSeconds(p.time) as never,
      value: p.value,
    }));

    hs.setData(homeData);
    ds.setData(drawData);
    as.setData(awayData);

    // 首次有点位时 fitContent 一次；之后依靠 fixLeftEdge/fixRightEdge 维持贴边。
    const hasAny = homeData.length > 0 || drawData.length > 0 || awayData.length > 0;
    if (!didFitContentRef.current && hasAny) {
      chart.timeScale().fitContent();
      didFitContentRef.current = true;
    }
  }, [ready, trend]);

  // ── Color effect：颜色变化局部 applyOptions（v5 文档确认热更新无闪烁）
  useEffect(() => {
    if (!ready) return;
    homeSeriesRef.current?.applyOptions({ color: homeColor });
    drawSeriesRef.current?.applyOptions({ color: drawColor });
    awaySeriesRef.current?.applyOptions({ color: awayColor });
  }, [ready, homeColor, drawColor, awayColor]);

  // ── Height effect：高度变化只 resize，不重建
  useEffect(() => {
    if (!ready) return;
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container) return;
    chart.resize(container.clientWidth, height);
  }, [ready, height]);

  // X 轴标签 — 从 trend.home 均匀采样 5 个时间点（对齐 Figma 6123:95149）
  const axisLabels = pickEvenTicks(trend.home, AXIS_TICK_COUNT).map((p) => formatAxisTime(p.time));

  return (
    <div className="flex flex-col w-full" data-figma-node="5107:182751">
      <div className="relative w-full" style={{ height }}>
        {/* Chart 渲染目标 */}
        <div
          ref={containerRef}
          className="w-full h-full"
          aria-hidden={!ready}
          data-testid="moneyline-chart-container"
        />

        {/* Hover Tooltip — Figma 节点 5107:182680 */}
        {tooltip.visible && (
          <div
            className="absolute pointer-events-none z-10"
            style={{ left: tooltip.x, top: tooltip.y }}
            data-figma-node="5107:182680"
          >
            {/* @figma-hardcoded: #212124 tooltip-bg — matches bg/tertiary token */}
            <div
              className="flex flex-col gap-1 p-2 rounded-lg text-[12px] leading-[18px]"
              style={{
                backgroundColor: "#212124",
                boxShadow: "0px 10px 11px rgba(8,7,10,0.35)",
              }}
            >
              {/* 时间行 */}
              <p className="text-primary whitespace-nowrap">{tooltip.time}</p>

              {/* Home 行 */}
              {tooltip.homePct !== null && (
                <div className="flex items-center gap-1">
                  <span
                    className="inline-block size-3 rounded-sm shrink-0"
                    style={{ backgroundColor: homeColor }}
                  />
                  <span className="text-secondary whitespace-nowrap">{homeName}</span>
                  <span className="text-primary whitespace-nowrap">{tooltip.homePct}%</span>
                </div>
              )}

              {/* Draw 行 */}
              {tooltip.drawPct !== null && (
                <div className="flex items-center gap-1">
                  <span
                    className="inline-block size-3 rounded-sm shrink-0"
                    style={{ backgroundColor: drawColor }}
                  />
                  <span className="text-secondary whitespace-nowrap">Draw</span>
                  <span className="text-primary whitespace-nowrap">{tooltip.drawPct}%</span>
                </div>
              )}

              {/* Away 行 */}
              {tooltip.awayPct !== null && (
                <div className="flex items-center gap-1">
                  <span
                    className="inline-block size-3 rounded-sm shrink-0"
                    style={{ backgroundColor: awayColor }}
                  />
                  <span className="text-secondary whitespace-nowrap">{awayName}</span>
                  <span className="text-primary whitespace-nowrap">{tooltip.awayPct}%</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* X 轴时间标签（自渲染，统一字重）— pr 匹配右侧价格轴宽度对齐绘图区 */}
      <div className="flex justify-between pt-2" style={{ paddingRight: PRICE_SCALE_WIDTH }}>
        {axisLabels.map((label, idx) => (
          <span key={`${label}-${idx}`} className="text-[11px] leading-none text-tertiary">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ENH-031 B2.3：所有 prop 稳定（colors 模块顶层常量，trend 走 useMoneylineHistory useMemo 稳定，
// names 是 fixture.participants 字段稳定，height 字面量）→ React.memo 直接命中，
// 隔离 MatchDetailColumnHost 15s poll 引起的全树重渲。
export default memo(MoneylineChart);
