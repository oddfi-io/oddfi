"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface RiskSliderProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}

type BucketKey =
  | "veryConservative"
  | "conservative"
  | "moderate"
  | "balanced"
  | "aggressive"
  | "veryAggressive";

const LABEL_BUCKETS: Array<{ max: number; key: BucketKey }> = [
  { max: 1, key: "veryConservative" },
  { max: 3, key: "conservative" },
  { max: 5, key: "moderate" },
  { max: 7, key: "balanced" },
  { max: 9, key: "aggressive" },
  { max: 10, key: "veryAggressive" },
];

function bucketKeyFor(v: number): BucketKey | null {
  return LABEL_BUCKETS.find((b) => v <= b.max)?.key ?? null;
}

/**
 * 风险偏好 slider（DD-106 Step2 · Figma 6404:87864）。
 *
 * Figma 大卡片：
 *   - 左上：当前值 + 「/ 10 · {label}」（JetBrains Mono 数字 + Inter 后缀）
 *   - 右上：「RISK PREFERENCE」品牌印章（mono uppercase tracking-wider）
 *   - 中部：渐变 track 蓝→绿→红（hint 越右越激进）+ native range input 透明叠加捕获事件
 *   - 下方：0-10 共 11 个数字 ticks
 *   - 底部：◀ 极度保守（左）/ 极度进取 ▶（右）
 *
 * 渐变颜色与左下/右下三角箭头来自 Figma 6404:87870 / 87896 / 87901（@figma-hardcoded）。
 */
export function RiskSlider({ value, onChange, min = 0, max = 10 }: RiskSliderProps) {
  const inputId = useId();
  const t = useTranslations("aiAgent.wizard.step2.risk");
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const bucketKey = bucketKeyFor(value);

  return (
    // @figma-hardcoded: bg #111114 + border #212124（fill/fill/input1 + line/border-secondary）
    <div className="relative w-full rounded-lg border border-solid border-[#212124] bg-fill-card1 p-4">
      {/* 顶部：左数值 + 右印章 */}
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          {/* @figma-hardcoded: text #00e6a0 — 风险值高亮色（比 fn-brand 略偏黄绿，待 token 整理） */}
          <span className="font-mono text-[17px] font-bold leading-[25.5px] text-[#00e6a0]">
            {value}
          </span>
          {/* @figma-hardcoded: #b8c1cc — 副值字色，比 secondary 亮一档 */}
          <span className="text-[13px] leading-[19.5px] text-[#b8c1cc]">
            / {max} · {bucketKey ? t(`buckets.${bucketKey}`) : "—"}
          </span>
        </div>
        {/* @figma-hardcoded: #6b7785 + tracking 1.1px — 角标印章风 */}
        <span className="font-mono text-[11px] leading-[16.5px] tracking-[1.1px] text-[#6b7785]">
          RISK PREFERENCE
        </span>
      </div>

      {/* slider 主轨：渐变 track + 透明 native input */}
      <div className="relative flex h-[30px] items-center">
        <div
          aria-hidden
          // @figma-hardcoded: gradient 蓝→绿→红，0.85/0.95/0.85 alpha（DD-106 v3 提亮）
          className="h-[6px] w-full rounded-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(77,159,255,0.85) 0%, rgba(0,230,160,0.95) 50%, rgba(255,71,87,0.85) 100%)",
          }}
        />
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={t("ariaLabel")}
          className={cn(
            "absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent",
            // thumb：12×12 实心白圆 + 浅描边阴影，仅作为拖拽 hint，不与 Figma 渐变 track 抢视觉重心
            "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
            "[&::-webkit-slider-thumb]:border-0",
            "[&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(255,255,255,0.4)]",
            "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:appearance-none",
            "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white",
            "[&::-moz-range-thumb]:border-0"
          )}
        />
      </div>

      {/* ticks 0..10 */}
      <div className="mt-2 flex justify-between px-[3px]">
        {ticks.map((t) => (
          <span key={t} className="font-mono text-[9.5px] leading-[14.25px] text-[#6b7785]">
            {t}
          </span>
        ))}
      </div>

      {/* 端点标签：◀ 极度保守 / 极度进取 ▶ */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] leading-[16.5px] text-[#6b7785]">
          {/* @figma-hardcoded: ◀ 蓝箭头 #4d9fff */}
          <span className="mr-1 text-[#4d9fff]">◀</span> {t("buckets.veryConservative")}
        </span>
        <span className="text-[11px] leading-[16.5px] text-[#6b7785]">
          {t("buckets.veryAggressive")} {/* @figma-hardcoded: ▶ 红箭头 #ff4757 */}
          <span className="ml-1 text-[#ff4757]">▶</span>
        </span>
      </div>
    </div>
  );
}
