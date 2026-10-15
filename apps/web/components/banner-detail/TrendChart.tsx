"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi } from "lightweight-charts";
import type { TrendSeriesMock } from "@/lib/banner-detail-fixtures";

interface Props {
  /** 4 条折线（key/label/color/values/pctLabel） */
  series: TrendSeriesMock[];
  /** Y 轴上限（百分比，本轮 fixed 30） */
  yMax: number;
  /** 容器高度，默认 280 */
  height?: number;
}

const SECONDS_PER_DAY = 86400;

/**
 * TrendChart：详情页趋势线 + 顶部 Legend 圆点列表
 *
 * Figma 节点：[3550:74100](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3550-74100)
 * 对应 Vector 6/7/8/9 4 条曲线（颜色 + 轨迹近似，不要求 path 像素级）
 *
 * 实现：lightweight-charts v5 dynamic import + 4× LineSeries
 * 模式参考：components/swap/TokenChartCard.tsx（cancel flag 防 StrictMode 双调用）
 */
export default function TrendChart({ series, yMax, height = 280 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    async function init() {
      if (!containerRef.current) return;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      // lightweight-charts v5 is ESM-only — must use dynamic import()
      const { createChart, LineSeries, ColorType } = await import("lightweight-charts");
      if (cancelled || !containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#8b8d93",
          fontSize: 11,
          attributionLogo: false,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: "rgba(255,255,255,0.06)", visible: true },
        },
        crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
        rightPriceScale: {
          borderVisible: false,
          textColor: "#8b8d93",
          scaleMargins: { top: 0.05, bottom: 0.05 },
          // Y 轴贴右（Figma 3646:135905 H5 设计），默认 priceScale 最小宽 ~50px 留太多空白
          minimumWidth: 28,
          entireTextOnly: true,
        },
        timeScale: { borderVisible: false, timeVisible: false, secondsVisible: false },
        width: containerRef.current.clientWidth,
        height,
        handleScroll: false,
        handleScale: false,
      });

      // 14 等距日期（每周 1 个数据点，base = 今天 - 90d）
      const length = series[0]?.values.length ?? 0;
      const baseSec = Math.floor(Date.now() / 1000) - 90 * SECONDS_PER_DAY;
      const times = Array.from({ length }, (_, i) => (baseSec + i * 7 * SECONDS_PER_DAY) as never);

      for (const s of series) {
        const line = chart.addSeries(LineSeries, {
          color: s.color,
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          // Y 轴显示百分号（custom formatter，避免 type:'percent' 在 Normal scale 下产出 NaN%）
          priceFormat: {
            type: "custom",
            formatter: (price: number) => (Number.isFinite(price) ? `${Math.round(price)}%` : ""),
            minMove: 1,
          },
        });
        line.setData(s.values.map((v, i) => ({ time: times[i], value: v })));
      }

      chart.timeScale().fitContent();
      chartRef.current = chart;
      setReady(true);
    }

    init();
    return () => {
      cancelled = true;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [series, yMax, height]);

  return (
    <div className="flex flex-col gap-6 w-full" data-figma-node="3550:74100">
      {/* Legend: 圆点 + 国家/球员 + 百分比标签 */}
      <ul
        className="flex flex-wrap gap-3 list-none"
        data-figma-node="3550:74101"
        aria-label="Trend legend"
      >
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            <span className="text-[14px] leading-[1.8] text-white whitespace-nowrap">
              {s.label} {s.pctLabel}
            </span>
          </li>
        ))}
      </ul>

      {/* Chart container — lightweight-charts 渲染目标 */}
      <div
        ref={containerRef}
        className="w-full"
        style={{ height }}
        aria-hidden={!ready}
        data-testid="trend-chart-container"
      />
    </div>
  );
}
