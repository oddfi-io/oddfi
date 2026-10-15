"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";
import {
  ChartLineIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  CheckIcon,
} from "@phosphor-icons/react";
import CaretDownCustomIcon from "@/components/icons/CaretDownCustomIcon";
import KLineIcon from "@/components/icons/KLineIcon";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { useBnbKline } from "@/hooks/useBnbKline";
import { sub, div, mul, formatAmount, formatPrice } from "@/lib/decimal";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";

type ChartType = "line" | "candle";
type Interval = "24h" | "7d" | "30d";

const INTERVALS: Interval[] = ["24h", "7d", "30d"];

// 平台币市场概览数据（mock — 待对接真实数据源；DD-090 后端就绪后切换）
const STATS_DATA = {
  marketCap: "$89.24B",
  volume24h: "$1.42B",
  totalSupply: "145.93M",
  circulatingSupply: "145.93M",
};

// Raw hex values required for lightweight-charts JS API (cannot use Tailwind classes here)
const CHART_COLORS = {
  green: "#2DB270",
  greenAlpha40: "rgba(45, 178, 112, 0.4)",
  greenAlpha0: "rgba(45, 178, 112, 0)",
  red: "#ED4C52",
  redAlpha40: "rgba(237, 76, 82, 0.4)",
  redAlpha0: "rgba(237, 76, 82, 0)",
  text: "#5c5d61",
  crosshair: "#5c5d61",
} as const;

export default function TokenChartCard() {
  const t = useTranslations("swap");
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

  const [chartType, setChartType] = useState<ChartType>("line");
  const [interval, setInterval] = useState<Interval>("24h");
  const [chartReady, setChartReady] = useState(false);

  const { data: allData, latestBar } = useBnbKline();

  const data = useMemo(() => {
    if (allData.length === 0) return [];
    const sliceMap: Record<Interval, number> = { "24h": 24, "7d": 168, "30d": Infinity };
    const n = sliceMap[interval];
    return n === Infinity ? allData : allData.slice(-n);
  }, [allData, interval]);

  // 涨跌幅计算（data 为空时用占位值，守卫在所有 hooks 之后触发）
  const lastPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const firstOpen = data.length > 0 ? data[0].open : 0;
  const pctChange =
    firstOpen !== 0
      ? mul(div(sub(String(lastPrice), String(firstOpen)), String(firstOpen)), "100")
      : "0";
  const isUp = Number(pctChange) >= 0;

  // ── Effect 1: 图表创建 + 数据填充（合并为单 effect 消除 async 竞态）──────────
  // lightweight-charts v5 is ESM-only — must use dynamic import(), not require()
  // Cancellation flag prevents StrictMode double-invoke race condition.
  useEffect(() => {
    let cancelled = false;

    setChartReady(false);

    async function initChart() {
      if (!containerRef.current) return;
      // 销毁旧实例
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }

      const { createChart, CandlestickSeries, AreaSeries, LineStyle, ColorType } =
        await import("lightweight-charts");

      // async 结束后检查 cleanup
      if (cancelled || !containerRef.current) return;

      const trendColor = isUp ? CHART_COLORS.green : CHART_COLORS.red;

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: CHART_COLORS.text,
          fontSize: 11,
          attributionLogo: false,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        crosshair: {
          vertLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: "#212124" },
          horzLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: "#212124" },
        },
        rightPriceScale: {
          borderVisible: false,
          textColor: CHART_COLORS.text,
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        handleScroll: false,
        handleScale: false,
      });

      let series: ISeriesApi<SeriesType>;

      if (chartType === "candle") {
        series = chart.addSeries(CandlestickSeries, {
          upColor: CHART_COLORS.green,
          downColor: CHART_COLORS.red,
          borderUpColor: CHART_COLORS.green,
          borderDownColor: CHART_COLORS.red,
          wickUpColor: CHART_COLORS.green,
          wickDownColor: CHART_COLORS.red,
          lastValueVisible: false,
        });
      } else {
        series = chart.addSeries(AreaSeries, {
          lineColor: trendColor,
          topColor: isUp ? CHART_COLORS.greenAlpha40 : CHART_COLORS.redAlpha40,
          bottomColor: isUp ? CHART_COLORS.greenAlpha0 : CHART_COLORS.redAlpha0,
          lineWidth: 2 as const,
          lastValueVisible: false,
          lastPriceAnimation: 0,
        });
      }

      chartRef.current = chart;
      seriesRef.current = series;

      // 创建完成后立即填充数据（消除 Effect 分离导致的 async 竞态）
      if (data.length > 0) {
        if (chartType === "candle") {
          series.setData(data as Parameters<typeof series.setData>[0]);
        } else {
          series.setData(
            data.map((d) => ({ time: d.time, value: d.close })) as Parameters<
              typeof series.setData
            >[0]
          );
        }
        chart.timeScale().fitContent();
        setChartReady(true);

        series.createPriceLine({
          price: data[data.length - 1].close,
          color: trendColor,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lineVisible: true,
          axisLabelVisible: true,
          axisLabelColor: trendColor,
          axisLabelTextColor: "#FFFFFF",
          title: "",
        });
      }
    }

    initChart();

    return () => {
      cancelled = true;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, data, isUp]);

  // ── Effect 3: 增量更新（latestBar 变化时，仅 series.update，不重建图表）────────
  useEffect(() => {
    if (!seriesRef.current || !latestBar) return;

    if (chartType === "candle") {
      seriesRef.current.update(latestBar as Parameters<typeof seriesRef.current.update>[0]);
    } else {
      seriesRef.current.update({ time: latestBar.time, value: latestBar.close } as Parameters<
        typeof seriesRef.current.update
      >[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestBar, chartType]);

  // Resize observer — stable ref, run once
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const observer = new ResizeObserver(() => {
      if (chartRef.current) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const hasData = data.length > 0;

  const renderIntervalTabs = () => (
    <div
      className="flex h-[36px] items-start rounded-full border bg-fill-input p-[4px]"
      style={{ backdropFilter: "blur(6.5px)", WebkitBackdropFilter: "blur(6.5px)" }}
    >
      {INTERVALS.map((iv) => (
        <button
          key={iv}
          onClick={() => setInterval(iv)}
          className={`flex h-full w-[48px] items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
            interval === iv ? "bg-tertiary text-primary" : "text-secondary hover:text-primary"
          }`}
          style={{ touchAction: "manipulation" }}
        >
          {iv}
        </button>
      ))}
    </div>
  );

  const renderChartTypeDropdown = () => (
    <DropdownMenu
      minWidth={168}
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="flex h-[36px] w-[48px] items-center justify-center gap-[4px] rounded-full border bg-fill-input text-secondary hover:text-primary transition-colors"
          style={{
            touchAction: "manipulation",
            backdropFilter: "blur(6.5px)",
            WebkitBackdropFilter: "blur(6.5px)",
          }}
          aria-label="Chart type"
        >
          <KLineIcon size={20} />
          <CaretDownCustomIcon size={12} />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <button
            onClick={() => {
              setChartType("line");
              close();
            }}
            className="flex h-[28px] w-full items-center justify-between px-1 py-[6px]"
            style={{ touchAction: "manipulation" }}
          >
            <span className="flex items-center gap-[6px]">
              <ChartLineIcon
                size={20}
                className={chartType === "line" ? "text-brand-default" : "text-primary"}
              />
              <span
                className={`text-[12px] font-medium leading-[18px] ${chartType === "line" ? "text-brand-default" : "text-primary"}`}
              >
                {t("lineChart")}
              </span>
            </span>
            {chartType === "line" && (
              <CheckIcon size={16} weight="bold" className="text-brand-default" />
            )}
          </button>
          <button
            onClick={() => {
              setChartType("candle");
              close();
            }}
            className="flex h-[28px] w-full items-center justify-between px-1 py-[6px]"
            style={{ touchAction: "manipulation" }}
          >
            <span className="flex items-center gap-[6px]">
              <KLineIcon
                size={20}
                className={chartType === "candle" ? "text-brand-default" : "text-secondary"}
              />
              <span
                className={`text-[12px] font-medium leading-[18px] ${chartType === "candle" ? "text-brand-default" : "text-secondary"}`}
              >
                {t("candleChart")}
              </span>
            </span>
            {chartType === "candle" && (
              <CheckIcon size={16} weight="bold" className="text-brand-default" />
            )}
          </button>
        </>
      )}
    </DropdownMenu>
  );

  return (
    <div className="relative flex flex-col gap-[24px] rounded-16 bg-fill-card1 p-[16px] lg:gap-[40px] lg:p-[32px] overflow-hidden">
      {/* ── Header row：左 token info | 右 4-stat strip(PC only) ───────────────── */}
      <div className="flex items-start justify-between gap-[16px]">
        {/* Left: token name + price stacked */}
        <div className="flex flex-col gap-[8px]">
          {/* Token identity */}
          <div className="flex items-center gap-[12px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PLATFORM_TOKEN.iconUrl}
              alt={PLATFORM_TOKEN_DISPLAY}
              width={32}
              height={32}
              className="rounded-full flex-shrink-0 size-[24px] lg:size-[32px]"
            />
            <span className="text-primary font-bold text-[20px] leading-[28px]">
              {PLATFORM_TOKEN_DISPLAY}
            </span>
          </div>
          {/* Price + change */}
          {hasData ? (
            <div className="flex items-baseline gap-[8px]">
              <span className="text-primary font-bold text-[24px] leading-[normal] tracking-[-0.24px]">
                ${formatPrice(lastPrice)}
              </span>
              <div
                className={`flex items-center gap-[2px] text-[14px] font-medium leading-[18px] ${isUp ? "text-fn-green" : "text-fn-red"}`}
              >
                <span>
                  {isUp ? "+" : "-"}
                  {formatAmount(Math.abs(Number(pctChange)), 2)}%
                </span>
                {isUp ? <ArrowUpRightIcon size={16} /> : <ArrowDownRightIcon size={16} />}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-[8px]">
              <div className="h-[28px] lg:h-[32px] w-[120px] rounded bg-secondary animate-pulse" />
              <div className="h-[20px] w-[64px] rounded bg-secondary animate-pulse" />
            </div>
          )}
        </div>

        {/* Right: 4-stat strip (PC only) — 横排 items-center */}
        <div className="hidden lg:flex items-center gap-[16px] flex-shrink-0">
          {[
            { label: t("marketCap"), value: STATS_DATA.marketCap },
            { label: t("volume24h"), value: STATS_DATA.volume24h },
            { label: t("totalSupply"), value: STATS_DATA.totalSupply },
            { label: t("circulatingSupply"), value: STATS_DATA.circulatingSupply },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-[6px] items-center whitespace-nowrap"
            >
              <span className="text-tertiary text-[12px] leading-[18px]">{stat.label}</span>
              <span className="text-primary text-[12px] font-bold leading-[18px]">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── H5 stats grid (2×2) ────────────────────────────────────────────────── */}
      <div className="lg:hidden flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-[4px] items-start">
            <span className="text-tertiary text-[12px] leading-[18px]">{t("marketCap")}</span>
            <span className="text-primary text-[14px] font-medium leading-[18px]">
              {STATS_DATA.marketCap}
            </span>
          </div>
          <div className="flex flex-col gap-[4px] items-start">
            <span className="text-tertiary text-[12px] leading-[18px]">{t("volume24h")}</span>
            <span className="text-primary text-[14px] font-medium leading-[18px]">
              {STATS_DATA.volume24h}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-[4px] items-start">
            <span className="text-tertiary text-[12px] leading-[18px]">{t("totalSupply")}</span>
            <span className="text-primary text-[14px] font-medium leading-[18px]">
              {STATS_DATA.totalSupply}
            </span>
          </div>
          <div className="flex flex-col gap-[4px] items-end">
            <span className="text-tertiary text-[12px] leading-[18px]">
              {t("circulatingSupply")}
            </span>
            <span className="text-primary text-[14px] font-medium leading-[18px]">
              {STATS_DATA.circulatingSupply}
            </span>
          </div>
        </div>
      </div>

      {/* ── Chart block：PC controls(tabs+dropdown) + canvas（紧贴）─────────────── */}
      <div className="flex flex-col">
        {/* PC 控制行：tabs 在左，dropdown 在右 */}
        <div className="hidden lg:flex items-center gap-[12px] mb-[0]">
          {renderIntervalTabs()}
          {renderChartTypeDropdown()}
        </div>

        {/* §17-C: overflow-hidden prevents chart canvas from overflowing card */}
        <div className="relative overflow-hidden rounded-8">
          <div ref={containerRef} className="w-full h-[300px]" />
          {/* Skeleton overlay — visible until chart has rendered with data */}
          {!chartReady && <div className="absolute inset-0 rounded-8 bg-secondary animate-pulse" />}
        </div>
      </div>

      {/* Mobile interval tabs — centered below chart */}
      <div className="flex lg:hidden justify-center">{renderIntervalTabs()}</div>
    </div>
  );
}
