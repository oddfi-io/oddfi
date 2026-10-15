"use client";

import type { ReactNode } from "react";

interface Props {
  /** 网格列数：默认 2 列；BetSlip 激活时切 1 列 */
  columns: 1 | 2;
  children: ReactNode;
}

/**
 * OddsCardGrid：详情页赔率卡网格容器（DD-085 §3.4）
 *
 * Figma 节点：双列 [3550:73359](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3550-73359)
 *           / 单列 [3471:68174](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3471-68174)
 * 间隙：16px（横向 + 纵向）
 * 用途：包裹 CountryOddsCard / PlayerOddsCard，BetSlip 激活时由父组件切 1 列
 *
 * 排序流向（2026-04-27 验收）：
 *  - 2 列模式 → column-major（grid-rows-5 + grid-flow-col）：左列 rank 1-5、右列 rank 6-10
 *  - 1 列模式 → 默认 row-major：rank 1-10 自上而下
 */
export default function OddsCardGrid({ columns, children }: Props) {
  // H5 强制 1 列（grid-cols-1）；PC 由 columns prop 控制
  // Tailwind JIT 不支持动态 class — 用三元显式写出两种 PC 变体
  const pcClass =
    columns === 1 ? "md:grid-cols-1" : "md:grid-cols-2 md:grid-rows-5 md:grid-flow-col";

  return (
    <div
      className={`grid gap-4 grid-cols-1 ${pcClass}`}
      data-figma-node={columns === 1 ? "3471:68174" : "3550:73359"}
    >
      {children}
    </div>
  );
}
