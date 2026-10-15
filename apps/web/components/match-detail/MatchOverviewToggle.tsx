"use client";

/**
 * MatchOverviewToggle — Part 2 内联折叠条
 *
 * 渲染位置：MatchOverviewPanel 内 VenueCard 与 OverviewTabs 之间。
 * 视觉：全宽 24px 高横条，顶部 12% 白色分隔线，中央 Caret 图标。
 * 状态：collapsed=false → ▲（点击折叠下方 tab 区）；collapsed=true → ▼（点击展开）。
 */

import { CaretUpIcon, CaretDownIcon } from "@phosphor-icons/react";

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function MatchOverviewToggle({ collapsed, onToggle }: Props) {
  const Icon = collapsed ? CaretDownIcon : CaretUpIcon;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand overview details" : "Collapse overview details"}
      style={{ touchAction: "manipulation" }}
      className="relative w-full h-[24px] flex items-center justify-center border-t border-[rgba(224,224,224,0.12)] hover:bg-[rgba(224,224,224,0.04)] transition-colors"
    >
      <Icon size={14} weight="bold" className="text-[#e0e0e0] opacity-80" />
    </button>
  );
}
