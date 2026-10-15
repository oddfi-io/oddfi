"use client";

// SegmentedTabs — pill 风格分段切换器（流动性池 / Bracket 等共用）
// 容器：h-44 圆角胶囊，bg-fill-input + border-secondary
// 按钮：h-36，激活态 bg-btn-primary-white + text-static-black

import type { ReactNode } from "react";

export interface SegmentedTabItem<T extends string = string> {
  key: T;
  label: ReactNode;
}

interface SegmentedTabsProps<T extends string = string> {
  tabs: SegmentedTabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  /** 容器追加 class（如 "lg:w-fit" 让 PC 端按内容收缩） */
  containerClassName?: string;
  /** 按钮追加 class（如 "lg:w-[120px] lg:flex-none" 让 PC 端按钮固定宽） */
  itemClassName?: string;
  ariaLabel?: string;
}

export default function SegmentedTabs<T extends string = string>({
  tabs,
  value,
  onChange,
  containerClassName,
  itemClassName,
  ariaLabel,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[
        "flex items-center h-[44px] w-full bg-fill-input border border-secondary rounded-full p-[4px]",
        containerClassName ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            style={{ touchAction: "manipulation" }}
            className={[
              "flex-1 h-[36px] rounded-full text-[14px] font-semibold leading-[19px] flex items-center justify-center transition-colors",
              itemClassName ?? "",
              active
                ? "bg-btn-primary-white text-static-black"
                : "text-secondary hover:text-primary",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
