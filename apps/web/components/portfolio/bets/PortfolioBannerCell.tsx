"use client";

import { memo } from "react";
import { tagClasses } from "@/lib/bet-tag-classes";
import PlayerAvatar from "@/components/banner-detail/PlayerAvatar";

/**
 * 结构化最小入参（同时被 PortfolioBet / TransactionRecord 满足）：
 * - banner.title 用作主标题；缺失时回退 selectionTag
 * - selectionTag 必填（avatar fallback 取首字符 + 第一个 tag）
 * - odds 可选（部分流水如 cashout 可能为 undefined）
 */
interface PortfolioBannerCellInput {
  banner?: { code: string; title: string };
  selectionTag?: string;
  odds?: string;
}

interface PortfolioBannerCellProps {
  bet: PortfolioBannerCellInput;
  /**
   * 头像尺寸 — PC 行 48，H5 卡 32 / 28；调用方按视口决定
   */
  avatarSize?: number;
  /** 标签布局 gap，PC 8 / H5 4 */
  tagGap?: number;
  /** 文字层级，PC 14 / H5 14（Figma 一致） */
  titleClassName?: string;
}

/**
 * Banner 流水行 Market 列内容（Figma 3471:72197 — banner bet record row）
 *
 * 仅渲染 [avatar + title + (selection tag, odds tag)] 内层结构，
 * 列容器宽度、外 padding、chevron 留给调用方控制（Active vs Settled 列宽不同）。
 *
 * 头像 fallback：黄底 + 选项首字母（与 banner detail PlayerOddsCard 一致）；
 * 后端补 banner_image 字段后切真图（见 lib/banner-portfolio-meta.ts TODO）。
 */
function PortfolioBannerCell({
  bet,
  avatarSize = 48,
  tagGap = 8,
  titleClassName = "text-[14px] font-semibold text-primary leading-[19px]",
}: PortfolioBannerCellProps) {
  const selection = bet.selectionTag ?? "";
  const title = bet.banner?.title ?? selection;

  return (
    <>
      <PlayerAvatar name={selection} size={avatarSize} fontSize={Math.round(avatarSize * 0.375)} />
      <div className="flex flex-col gap-[4px] min-w-0">
        <span className={`${titleClassName} truncate`}>{title}</span>
        <div className="flex items-center" style={{ gap: tagGap }}>
          <span
            className={`${tagClasses("selection")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
          >
            {selection}
          </span>
          {bet.odds && (
            <span
              className={`${tagClasses("odds")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
            >
              {bet.odds} x
            </span>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(PortfolioBannerCell);
