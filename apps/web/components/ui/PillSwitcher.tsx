"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * PillSwitcher — 全圆胶囊式 segmented tabs（Figma 6566:138634）。
 *
 * 与 [[SegmentedChips]] 的区别：
 *   - SegmentedChips：紧凑 h-37 矩形 + rounded-8 + 选中态薄荷绿，用于表单字段选项
 *   - PillSwitcher：宽 h-44 全圆 pill + 选中态白底黑字，用于页面级 tab 导航
 *
 * 容器内 flex 平均分配；item.disabled = 灰显 + 阻断点击（aria-disabled）。
 */
export interface PillSwitcherItem<T extends string = string> {
  key: T;
  label: ReactNode;
  disabled?: boolean;
}

interface PillSwitcherProps<T extends string = string> {
  items: PillSwitcherItem<T>[];
  value: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
  containerClassName?: string;
}

export function PillSwitcher<T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
  containerClassName,
}: PillSwitcherProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      // @figma-hardcoded: border #212124 — Figma line/border-secondary，项目未注册同义 border token
      className={cn(
        "flex h-[44px] w-full items-stretch rounded-full border border-solid border-[#212124] bg-fill-input p-1",
        containerClassName
      )}
    >
      {items.map((item) => {
        const active = item.key === value;
        const disabled = item.disabled;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onChange(item.key);
            }}
            style={{ touchAction: "manipulation" }}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent px-3 py-[9px] text-sm font-semibold leading-[18px] transition",
              active && "bg-white text-static-black",
              !active && !disabled && "text-secondary hover:text-primary",
              disabled && "cursor-not-allowed text-tertiary opacity-50"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
