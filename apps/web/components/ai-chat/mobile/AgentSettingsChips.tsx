"use client";

/**
 * AgentSettingsChips — H5 Agent 设置页 tab 切换 chips（DD-135 Batch 2 · Figma 7973:128887 / 7973:128876~128880）。
 *
 * 5 × 80×32 圆角 100 chips（icon 16 + label 14 Medium，内部 gap-4）：
 *   - 选中：bg fill/button/tertiary-btn-default（bg-btn-tertiary）+ 文字 primary
 *   - 未选中：透明 + 文字 secondary
 *   - 总宽 400 > 容器 359 → 横向滚动（隐藏滚动条），选中项自动滚入视口
 *
 * 文案复用 aiChat.sidebar 键（DD §2.4 疑点 1：第 5 chip 设计稿 label 笔误，按 PC 导航顺序为「用量」）。
 * 32px 高属 Tab 切换器例外（mobile-h5.md min-h-44 豁免）。
 */

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  BellIcon,
  BrainIcon,
  DatabaseIcon,
  HandTapIcon,
  SlidersHorizontalIcon,
  type Icon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { ConfigTab } from "@/components/ai-agent/AgentConfigTabs";

const CHIP_ITEMS: { tab: ConfigTab; labelKey: string; icon: Icon }[] = [
  { tab: "basics", labelKey: "basics", icon: SlidersHorizontalIcon },
  { tab: "behavior", labelKey: "behavior", icon: HandTapIcon },
  { tab: "notify", labelKey: "notification", icon: BellIcon },
  { tab: "memory", labelKey: "memory", icon: BrainIcon },
  { tab: "usage", labelKey: "usage", icon: DatabaseIcon },
];

interface AgentSettingsChipsProps {
  activeTab: ConfigTab;
  onSelect: (tab: ConfigTab) => void;
}

export function AgentSettingsChips({ activeTab, onSelect }: AgentSettingsChipsProps) {
  const t = useTranslations("aiChat.sidebar");
  const containerRef = useRef<HTMLDivElement>(null);

  // 选中项自动滚入视口：容器自身横向滚动，inline nearest 不抖动页面纵向（animation.md 滚动定位）
  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${activeTab}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [activeTab]);

  return (
    <div ref={containerRef} className="scrollbar-hide flex w-full overflow-x-auto">
      {CHIP_ITEMS.map((item) => {
        const IconCmp = item.icon;
        const active = item.tab === activeTab;
        return (
          <button
            key={item.tab}
            type="button"
            data-tab={item.tab}
            onClick={() => onSelect(item.tab)}
            aria-current={active ? "page" : undefined}
            style={{ touchAction: "manipulation" }}
            className={cn(
              // min-w-80：设计稿（中文 2 字）固定 80px；英文长文案（Notification）自适应加宽防溢出互叠
              "flex h-[32px] min-w-[80px] shrink-0 cursor-pointer items-center justify-center gap-[4px] rounded-[100px] px-[12px] transition-colors",
              active ? "bg-btn-tertiary text-primary" : "bg-transparent text-secondary"
            )}
          >
            <IconCmp size={16} weight="regular" className="shrink-0" />
            <span className="whitespace-nowrap text-[14px] font-medium leading-[18px]">
              {t(item.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
