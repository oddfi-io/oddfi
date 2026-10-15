"use client";

// UnderlineTabs — 下划线分段切换器
// 透明底 + 等宽按钮，激活态：opacity-100 + 底部白色下划线
// 用法：详情面板底部主 tab (md size) + StandingsTab 子 tab (sm size)

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface UnderlineTabItem<T extends string = string> {
  key: T;
  label: ReactNode;
  /** 可选图标 URL（如 /images/match-detail/tab-h2h.svg）。传字符串走 <img>，传 ReactNode 直接渲染 */
  icon?: string | ReactNode;
}

export type UnderlineTabsSize = "sm" | "md";

interface UnderlineTabsProps<T extends string = string> {
  tabs: UnderlineTabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  /** sm: h-28/font-11, md: h-32/font-12. 默认 md */
  size?: UnderlineTabsSize;
  /** 容器边线位置。底部主 tab 用 "top", 子 tab 用 "bottom"，默认 "none" */
  borderPosition?: "top" | "bottom" | "none";
  /** 容器追加 class */
  className?: string;
  ariaLabel?: string;
}

const SIZE_MAP: Record<UnderlineTabsSize, { h: string; text: string; iconSize: string }> = {
  sm: { h: "h-[28px]", text: "text-[11px]", iconSize: "size-[14px]" },
  md: { h: "h-[32px]", text: "text-[12px]", iconSize: "size-[16px]" },
};

const BORDER_MAP: Record<NonNullable<UnderlineTabsProps["borderPosition"]>, string> = {
  top: "border-t border-[rgba(255,255,255,0.08)]",
  bottom: "border-b border-[rgba(255,255,255,0.08)]",
  none: "",
};

export default function UnderlineTabs<T extends string = string>({
  tabs,
  value,
  onChange,
  size = "md",
  borderPosition = "none",
  className,
  ariaLabel,
}: UnderlineTabsProps<T>) {
  const sz = SIZE_MAP[size];

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex w-full", BORDER_MAP[borderPosition], className)}
    >
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            style={{ touchAction: "manipulation" }}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-[6px] leading-[14px] text-[#e0e0e0] transition-opacity",
              sz.h,
              sz.text,
              active ? "opacity-100" : "opacity-60 hover:opacity-100"
            )}
          >
            {typeof tab.icon === "string" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tab.icon} alt="" aria-hidden="true" className={`block ${sz.iconSize}`} />
            ) : (
              tab.icon
            )}
            <span>{tab.label}</span>
            {active && (
              <span
                aria-hidden="true"
                className="absolute left-0 right-0 bottom-0 border-t-2 border-[#e0e0e0]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
