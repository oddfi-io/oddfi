"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * SegmentedChips — 紧凑型 segmented control（Figma 6455:123062）。
 *
 * 与 [[SegmentedTabs]] 的区别：
 *   - SegmentedTabs：全圆胶囊 h-44，主导航/页签切换（PoolsPage / BracketSwitcher）
 *   - SegmentedChips：紧凑 h-37 矩形 + 圆角 8，表单字段选项（AI 类型、风险等级等）
 *
 * 容器默认 inline-flex w-fit，由 N 个 item × 53px 自适应宽度；可通过 `containerClassName` 覆盖。
 *
 * 注意：所有 conditional className 走 `cn()`（基于 tailwind-merge），
 * 自动消解 `bg-transparent` vs `bg-fn-brand` 这类同 utility family 的冲突 ——
 * 不再依赖手动把冲突项拆到不同分支。
 */
export interface SegmentedChipItem<T extends string = string> {
  key: T;
  label: ReactNode;
}

interface SegmentedChipsProps<T extends string = string> {
  items: SegmentedChipItem<T>[];
  value: T;
  onChange: (key: T) => void;
  /** 单个 item 宽度（px），默认 53（Figma 标定值） */
  itemWidth?: number;
  /** 容器追加 class */
  containerClassName?: string;
  ariaLabel?: string;
}

export default function SegmentedChips<T extends string = string>({
  items,
  value,
  onChange,
  itemWidth = 53,
  containerClassName,
  ariaLabel,
}: SegmentedChipsProps<T>) {
  return (
    // w-fit 防止父级 flex column 的 align-items:stretch 把 inline-flex 横向撑满
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      // @figma-hardcoded: border #2a3440 — segmented 容器描边色，未在 token，待 design 补全
      className={cn(
        "inline-flex h-[37px] w-fit shrink-0 self-start items-center gap-[2px] rounded-lg border border-solid border-[#2a3440] p-[2px]",
        containerClassName
      )}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.key)}
            style={{ width: itemWidth, touchAction: "manipulation" }}
            // @figma-hardcoded: 未选中字色 #6b7785；选中字色 #002818（mint 上的深绿对比色）
            // base 故意保留 bg-transparent 验证 cn()/twMerge 能正确消解与 active 的 bg-fn-brand 冲突
            className={cn(
              "flex h-[31px] cursor-pointer items-center justify-center rounded-md border-0 bg-transparent px-0 text-[12.5px] leading-[18.75px] font-medium text-[#6b7785] transition hover:text-secondary",
              active && "bg-fn-brand font-semibold text-[#002818] hover:text-[#002818]"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
