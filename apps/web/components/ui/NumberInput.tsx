"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";

import { cn } from "@/lib/utils";

/**
 * NumberInput — 数值输入框（参考 SwapCard 的 amount input 实现 sanitize 路径）。
 *
 * 设计要点（针对 type="number" 的两个常见坑）：
 *   1. 隐藏浏览器默认 spinner（type="number" 自带的小箭头）→ 用 type="text" + inputMode 控制移动端键盘
 *   2. 受控 number value 在 React 重渲染时会被强制 toString，造成 "01000" 之类怪相 → 内部维护 string state
 *      只在用户输入时调 onChange(number)；外部 value 变化不强制同步内部 text（防止打到一半被截断）
 *
 * Props：
 *   - value: number（外部状态，仅在初始化时映射到内部 text）
 *   - onChange: (next: number) => void
 *   - integerOnly: 仅整数（默认 false，允许小数）
 *   - min: 最小值，空输入 / 低于 min 时 clamp（默认 0）
 */
export interface NumberInputProps {
  value: number;
  onChange: (next: number) => void;
  integerOnly?: boolean;
  min?: number;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export default function NumberInput({
  value,
  onChange,
  integerOnly = false,
  min = 0,
  placeholder,
  ariaLabel,
  className,
}: NumberInputProps) {
  // 仅初始化时同步外部 value；后续依赖用户键盘事件驱动 text 演进
  const [text, setText] = useState<string>(() => (value === min ? "" : String(value)));

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      setText("");
      onChange(min);
      return;
    }
    const pattern = integerOnly ? /^\d+$/ : /^\d*\.?\d*$/;
    if (!pattern.test(raw)) return;
    setText(raw);
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(n < min ? min : n);
  };

  return (
    <input
      type="text"
      inputMode={integerOnly ? "numeric" : "decimal"}
      autoComplete="off"
      aria-label={ariaLabel}
      value={text}
      placeholder={placeholder}
      onChange={handleChange}
      className={cn(
        "block h-12 w-full rounded-lg border-0 bg-fill-card1 px-3 text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-dt-hover",
        className
      )}
    />
  );
}
