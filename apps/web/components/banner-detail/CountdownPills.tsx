"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import type { BannerCountdownMock } from "@/lib/banner-detail-fixtures";

interface Props {
  /** 倒计时数据（D/H/M/S）；本轮静态字符串，不接 setInterval */
  countdown: BannerCountdownMock;
  /** 标题，未传则取 next-intl key markets.bannerDetailEndIn */
  label?: string;
  /**
   * H5 inline 模式（Figma 3646:135911）：
   * - true  → "End in 90D : 31H : 31M : 14S" 同行排列（H5 hero card）
   * - false → "End in" 单行 + pills 单行右对齐（PC，DD-085 §3.5）
   */
  mobile?: boolean;
}

// H5 pill 较小：12px Bold（Figma 3646:135914 px-1 py-0 rounded-4）
const PILL_BASE_MD =
  "inline-flex items-center justify-center px-1 rounded bg-tertiary text-white text-[14px] font-bold leading-[1.8] whitespace-nowrap";
const PILL_BASE_SM =
  "inline-flex items-center justify-center px-1 rounded bg-tertiary text-white text-[12px] font-bold leading-[1.8] whitespace-nowrap";

/**
 * CountdownPills：详情页倒计时块
 *
 * Figma 节点：
 *  - PC [3550:74086]：右对齐 "End in" 单行 + pills 单行（14px Bold）
 *  - H5 [3646:135911]：inline `End in 90D : 31H : 31M : 14S` 同行（12px Bold）
 * Phase 2 静态字符串（DD-085 §1 范围外：实时倒计时 Phase 3）
 */
export default function CountdownPills({ countdown, label, mobile = false }: Props) {
  const t = useTranslations("markets");
  const displayLabel = label ?? t("bannerDetailEndIn");
  const pills = [
    `${countdown.days}D`,
    `${countdown.hours}H`,
    `${countdown.minutes}M`,
    `${countdown.seconds}S`,
  ];

  if (mobile) {
    return (
      <div className="flex w-full items-center gap-[10px]" data-figma-node="3646:135911">
        <p className="text-[12px] font-medium leading-[1.8] text-white whitespace-nowrap">
          {displayLabel}
        </p>
        <div className="flex flex-1 items-center gap-[7px]">
          {pills.map((pill, i) => (
            <Fragment key={pill}>
              <span className={PILL_BASE_SM}>{pill}</span>
              {i < pills.length - 1 && (
                <span
                  className="text-[12px] font-bold leading-none text-secondary"
                  aria-hidden="true"
                >
                  :
                </span>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end justify-center gap-[2px]" data-figma-node="3550:74086">
      <p className="w-full text-right text-[14px] font-medium leading-[1.8] text-white">
        {displayLabel}
      </p>
      <div className="flex items-center gap-[7px]">
        {pills.map((pill, i) => (
          <Fragment key={pill}>
            <span className={PILL_BASE_MD}>{pill}</span>
            {i < pills.length - 1 && (
              <span
                className="text-[14px] font-bold leading-none text-secondary"
                aria-hidden="true"
              >
                :
              </span>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
