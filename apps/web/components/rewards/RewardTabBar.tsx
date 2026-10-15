"use client";

import type { ReactNode } from "react";

import { SparkleIcon } from "@/components/icons/SparkleIcon";
import { cn } from "@/lib/utils";

/**
 * RewardTabBar —— 奖励中心主 Tab（任务中心 / 我的奖励）。Figma PC 9002:159405 · H5 9021:163963。
 *
 * 受控接口对齐 PillSwitcher（items/value/onChange）。品牌皮肤：
 *   - 选中：Orbitron Bold 薄荷绿文字 + 四角星图标 + 底部光晕 + 渐变下划线
 *   - 未选中：居中次级灰文字
 * 尺寸响应式：H5(<md) 60×127 / 20px；PC(md+) 84×160 / 28px。
 * 玻璃光晕(blur 17 · opacity .6)与下划线(白色 0.7 渐变)按 Figma SVG 用 CSS 还原，不下载资源。
 */
export interface RewardTabItem<T extends string = string> {
  key: T;
  label: ReactNode;
}

interface RewardTabBarProps<T extends string = string> {
  items: RewardTabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
}

export function RewardTabBar<T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
}: RewardTabBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex items-end justify-center gap-6 border-b border-divider md:gap-[120px]"
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            style={{ touchAction: "manipulation" }}
            className={cn(
              "relative flex h-[60px] w-[127px] cursor-pointer items-center justify-center overflow-visible md:h-[84px] md:w-[160px]",
              "font-orbitron text-[20px] font-bold leading-[28px] tracking-[-0.2px] md:text-[28px] md:leading-[36px] md:tracking-[-0.28px]",
              active ? "text-brand-default" : "text-secondary hover:text-primary"
            )}
          >
            {active && (
              <>
                {/* 底部光晕：mint 椭圆 blur17 opacity.6（Figma Ellipse 7244 CSS 还原） */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 bottom-[2px] h-[13px] w-[92px] -translate-x-1/2 rounded-full bg-brand-default opacity-60 md:h-[15px] md:w-[119px]"
                  style={{ filter: "blur(17px)" }}
                />
                {/* 渐变下划线：白色中亮两端透明 opacity.7（Figma Ellipse 7245 CSS 还原） */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 left-1/2 h-px w-[88px] -translate-x-1/2 md:w-[160px]"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0) 100%)",
                  }}
                />
              </>
            )}
            <span className="relative z-[1] flex items-center gap-[9px] md:gap-2">
              {active && <SparkleIcon className="h-[22px] w-[22px] shrink-0 md:h-6 md:w-6" />}
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
