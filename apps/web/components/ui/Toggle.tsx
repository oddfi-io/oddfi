"use client";

import { cn } from "@/lib/utils";

/**
 * Toggle — 42×24 mint pill 开关（Figma 6404:87916/87917）。
 *
 * 项目首个通用 toggle：以前散落的 `<input type="checkbox" accent-..." />` 视觉一致性差，
 * 本组件用 native `role="switch"` + 自定义 pill/thumb，aria-checked 双向同步。
 */
export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 屏读 label；可选但强烈建议传 */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

export default function Toggle({ checked, onChange, ariaLabel, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-[42px] shrink-0 cursor-pointer rounded-full border-0 transition-colors",
        checked ? "bg-fn-brand" : "bg-tertiary",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-[3px] block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-[left]",
          checked ? "left-[21px]" : "left-[3px]"
        )}
      />
    </button>
  );
}
