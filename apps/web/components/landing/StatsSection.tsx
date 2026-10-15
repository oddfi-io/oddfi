"use client";

import { useTranslations } from "next-intl";
import CountUpNumber from "./stats/CountUpNumber";

/**
 * §6 Stats — "平台实时数据" + 累计投注量 + 3 stat bars.
 *
 * Figma node: 4227:195195（1440×626）
 *   - Heading "平台实时数据"
 *   - $38,700,000 累计投注量 — 滚到视口触发 count-up 动画（0 → 38,700,000，1.2s ease-out）
 *   - 3 stat bars: $12.4M TVL / 24,800 active users / 1,240 settled matches — 同步 count-up
 *
 * 字体严格按 Figma：大数字 Racing Sans One（80/144px / stat bar 32px）。
 * 防容器抖动：动画过程数字 padStart 到目标位数（"00,000,000" → "38,700,000"），
 * 字符宽度恒定，赛车里程表风格 — 与 Racing Sans One 字体气质契合。
 */

/** 数字 padStart 到目标位数 + 加千分位逗号 — 赛车里程表风格 */
function makePaddedThousandsFormat(target: number) {
  const len = String(Math.floor(target)).length;
  return (v: number) => {
    const padded = String(Math.floor(v)).padStart(len, "0");
    return padded.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
}

type StatBar = {
  /** 数值（用于动画） */
  numericValue: number;
  /** 格式化函数 — 决定动画中每帧文本 */
  format: (v: number) => string;
  /** i18n label key under landing.stats */
  labelKey: "tvl" | "activeUsers" | "marketsResolved";
};

const STAT_BARS: StatBar[] = [
  {
    numericValue: 12.4,
    // 1 位小数 — 用整数运算避开 toFixed（项目 lint 禁用，要求精度走 lib/decimal）
    format: (v) => {
      const tenths = Math.floor(v * 10);
      return `$${Math.floor(tenths / 10)}.${tenths % 10}M`;
    },
    labelKey: "tvl",
  },
  {
    numericValue: 24800,
    format: makePaddedThousandsFormat(24800),
    labelKey: "activeUsers",
  },
  {
    numericValue: 1240,
    format: makePaddedThousandsFormat(1240),
    labelKey: "marketsResolved",
  },
];

const BIG_NUMBER_TARGET = 38_700_000;
const formatBigNumber = makePaddedThousandsFormat(BIG_NUMBER_TARGET);

/**
 * Decorative corner dot — repeated 4 corners of HorizontalBorder per Figma.
 * @figma-hardcoded: #38393d corner dot — pending design token
 */
function CornerDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute h-1 w-1 rounded-[1px] bg-[#38393d] ${className ?? ""}`}
    />
  );
}

export default function StatsSection() {
  const t = useTranslations("landing.stats");
  return (
    <section
      data-section="stats"
      data-figma-node="4227:195195"
      className="relative w-full overflow-hidden bg-primary"
    >
      {/* Decorative world-map dot pattern background — fades to bg at ~74% (Figma 4227:195196) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[74%] opacity-60"
        style={{
          backgroundImage: "url('/images/landing/stats-world-map.png')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Figma section 626×1440：标题 y=56.5 (h2-bottom 120) → 容器 y=160.5 (h 269) → stat bars y=469.5 (h 100) → 底 y=569.5
          垂直 padding：top 56 + bottom (626 - 569.5) = 56 → 用 py-14（56px），间距 gap-10（40px）按 Figma */}
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col items-center gap-10 px-6 pb-14 pt-14 md:px-12 md:pb-16 md:pt-16 lg:px-[120px] lg:pb-14 lg:pt-[120px]">
        {/* Heading — Figma 48px / lh 64 / Noto SC Bold */}
        <h2 className="font-noto-sc text-[32px] font-bold leading-[1.2] text-white md:text-[40px] lg:text-[48px] lg:leading-[64px]">
          {t("title")}
        </h2>

        {/* Cumulative volume container — Figma 1200×269, rounded-40, border #323232, px-64 py-44
            注意：justify-between 自动算 spacing，不能加 gap（否则 gap 会与子元素宽度叠加，挤压右 padding 视觉空间）*/}
        <div
          className="flex w-full max-w-[1200px] items-center justify-between overflow-hidden rounded-[24px] border px-6 py-8 md:rounded-[32px] md:px-10 md:py-10 lg:rounded-[40px] lg:px-[64px] lg:py-[44px]"
          style={{
            // @figma-hardcoded: #323232 container border — pending design token
            borderColor: "#323232",
          }}
        >
          {/* "累计投注量" — Figma 24px / lh 33.6 / #b9b9b9 / Noto Sans SC */}
          <span
            className="hidden whitespace-nowrap font-noto-sc text-[16px] font-normal leading-[1.4] md:block md:text-[20px] lg:text-[24px] lg:leading-[33.6px]"
            style={{
              // @figma-hardcoded: #b9b9b9 secondary label — pending design token
              color: "#b9b9b9",
            }}
          >
            {t("totalVolume")}
          </span>
          {/* Big number — Figma Racing Sans One: $ 80px brand-default, "38,700,000" 144px white */}
          <div className="flex items-center gap-2 md:gap-3 lg:gap-4">
            <span className="font-racing text-[40px] leading-none text-brand-default md:text-[56px] lg:text-[80px]">
              $
            </span>
            <CountUpNumber
              target={BIG_NUMBER_TARGET}
              duration={1.5}
              format={formatBigNumber}
              className="font-racing text-[56px] leading-none text-white md:text-[96px] lg:text-[144px]"
            />
          </div>
        </div>

        {/* 3 stat bars — Figma 1200×100，rounded-16, border rgba(255,255,255,0.1) */}
        <div
          className="flex w-full max-w-[1200px] flex-col items-stretch overflow-hidden rounded-[16px] border md:flex-row"
          style={{
            // @figma-hardcoded: rgba(255,255,255,0.1) outer border — pending design token
            borderColor: "rgba(255, 255, 255, 0.1)",
          }}
        >
          {STAT_BARS.map((bar, idx) => (
            <div
              key={bar.labelKey}
              className="relative flex flex-1 flex-col items-center justify-center gap-3 border p-4 md:h-[100px]"
              style={{
                // @figma-hardcoded: #161616 stat-bar bg, #252527 stat-bar border — pending design token
                backgroundColor: "#161616",
                borderColor: "#252527",
                marginRight: idx < STAT_BARS.length - 1 ? "-1px" : 0,
              }}
            >
              {/* Big number — Figma 32px / lh 36.8 / Racing Sans One，gradient #28f4d2 → #f4f5f7 */}
              <CountUpNumber
                target={bar.numericValue}
                duration={1.2}
                format={bar.format}
                className="bg-clip-text font-racing text-[24px] leading-[1.15] text-transparent md:text-[28px] lg:text-[32px] lg:leading-[36.8px]"
                style={{
                  // @figma-hardcoded: gradient #28f4d2 → #f4f5f7 — pending design token
                  backgroundImage: "linear-gradient(to left, #28f4d2 0%, #f4f5f7 100%)",
                }}
              />
              {/* Label — Figma 14px / lh 19 / #b9b9b9 / Noto SC */}
              <span
                className="font-noto-sc text-[14px] font-normal leading-[19px]"
                style={{
                  // @figma-hardcoded: #b9b9b9 secondary label — pending design token
                  color: "#b9b9b9",
                }}
              >
                {t(bar.labelKey)}
              </span>
              {/* Corner dots — Figma 4 corners, 4×4 #38393d */}
              <CornerDot className="left-[15px] top-[11px]" />
              <CornerDot className="left-[15px] bottom-[11px]" />
              <CornerDot className="right-[15px] top-[11px]" />
              <CornerDot className="right-[15px] bottom-[11px]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
