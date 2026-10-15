"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * Landing 页 carousel 左右翻页按钮（Figma 5523:88500 arrow btn —
 * Property=default / hovered / disabled 三态）。
 *
 * 共享于：
 * - §2 Hot Markets 预测卡 carousel（HotMarketsCarousel.tsx）
 * - §3 Advantages 「重新定义预测市场」卡片轨道（AdvantagesSection.tsx）
 *
 * 三态样式（hover / disabled 由 CSS variant 处理，无需 React state）：
 * | state    | border                   | inset shadow                          | icon color |
 * | -------- | ------------------------ | ------------------------------------- | ---------- |
 * | default  | rgba(255,255,255,0.06)   | inset 0 1px 0 rgba(255,255,255,0.1)   | #FFFFFF    |
 * | hovered  | rgba(255,255,255,0.26)   | inset 0 1px 0 rgba(255,255,255,0.7)   | #FFFFFF    |
 * | disabled | rgba(255,255,255,0.06)   | inset 0 1px 0 rgba(255,255,255,0.1)   | #5C5D61    |
 *
 * 通用尺寸：57px 高 / 16px 图标 / px-[21] py-[21/20] / rounded-[86px] 胶囊
 */
export interface CarouselArrowButtonProps {
  direction: "left" | "right";
  onClick?: () => void;
  disabled?: boolean;
  /** 默认按方向自动设置 "Previous" / "Next" */
  ariaLabel?: string;
}

export default function CarouselArrowButton({
  direction,
  onClick,
  disabled = false,
  ariaLabel,
}: CarouselArrowButtonProps) {
  const Icon = direction === "left" ? CaretLeftIcon : CaretRightIcon;
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? (direction === "left" ? "Previous" : "Next")}
      onClick={onClick}
      disabled={disabled}
      data-figma-node="5523:88497"
      // @figma-hardcoded: rgba(255,255,255,0.06) default border / rgba(255,255,255,0.26) hover border — pending design token
      // @figma-hardcoded: inset rgba(255,255,255,0.1) default highlight / 0.7 hover highlight — pending design token
      className="relative flex h-[57px] shrink-0 items-center justify-center rounded-[86px] border-l border-r border-t border-solid border-[rgba(255,255,255,0.06)] px-[21px] pb-[20px] pt-[21px] transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] enabled:hover:border-[rgba(255,255,255,0.26)] enabled:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        // @figma-hardcoded: linear-gradient(137.497deg, rgb(17,18,20) 4.87%, rgb(12,13,15) 75.88%) btn-bg — pending design token
        backgroundImage:
          "linear-gradient(137.497deg, rgb(17, 18, 20) 4.87%, rgb(12, 13, 15) 75.88%)",
        touchAction: "manipulation",
      }}
    >
      <Icon
        size={16}
        // @figma-hardcoded: #5C5D61 disabled chevron — pending design token
        color={disabled ? "#5C5D61" : "#FFFFFF"}
        weight="bold"
      />
    </button>
  );
}
