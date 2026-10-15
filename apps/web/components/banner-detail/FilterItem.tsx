"use client";

import { useState } from "react";

export type FilterSort = "asc" | "desc" | null;

interface Props {
  /** 显示文案 */
  label: string;
  /** 受控 sort 状态；不传则内部维护 */
  sort?: FilterSort;
  /** 默认 sort（仅非受控生效） */
  defaultSort?: FilterSort;
  /** 状态变化回调 */
  onChange?: (sort: FilterSort) => void;
}

/**
 * FilterItem：单个筛选 pill（DD-085 验收反馈 2026-04-27）
 *
 * Figma 节点：[3550:73551](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3550-73551)
 * 视觉：h-10 rounded-12 backdrop-blur-15 + 文字 + 上下双箭头
 * 颜色：以用户验收截图为准（teal #28f4d2，非 design_context 蓝色）
 *
 * 行为（点击循环）：default(null) → asc → desc → default(null)
 *  - default：两箭头灰 + 默认 idle 样式
 *  - asc：上箭头高亮 + active 样式（teal border + bg + text）
 *  - desc：下箭头高亮 + active 样式
 */
export default function FilterItem({ label, sort: sortProp, defaultSort = null, onChange }: Props) {
  const [internalSort, setInternalSort] = useState<FilterSort>(defaultSort);
  const sort = sortProp !== undefined ? sortProp : internalSort;
  const active = sort !== null;

  const handleClick = () => {
    const next: FilterSort = sort === null ? "asc" : sort === "asc" ? "desc" : null;
    if (sortProp === undefined) setInternalSort(next);
    onChange?.(next);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-figma-node="3550:73551"
      data-sort={sort ?? "default"}
      className={[
        "inline-flex h-10 items-center gap-2 rounded-[12px] border-[0.5px] py-[11px] pl-4 pr-3 backdrop-blur-[15px]",
        "text-[12px] font-medium leading-[18px] transition-colors",
        active
          ? // border = token line/border-hover (--line-border-hover #28f4d2 dark theme)；bg = brand-transparent；text = brand-default
            // @figma-hardcoded: rgba(40,244,210,0.15) filter-active-bg — pending design token (fill/tag/brand-transparent)
            "border-dt-hover bg-[rgba(40,244,210,0.15)] text-brand-default"
          : // @figma-hardcoded: #212124 filter-idle-border — pending design token (line/border-secondary)
            "border-[#212124] bg-secondary text-primary",
      ].join(" ")}
    >
      <span className="whitespace-nowrap">{label}</span>
      <SortArrows sort={sort} />
    </button>
  );
}

/** 上下双箭头图标：根据 sort 状态高亮对应箭头
 *  asc → 上箭头跟随 currentColor（active 时 teal）
 *  desc → 下箭头跟随 currentColor
 *  default(null) → 两箭头都用 #5c5d61（text/tertiary）
 */
function SortArrows({ sort }: { sort: FilterSort }) {
  // @figma-hardcoded: #5c5d61 sort-arrow-idle = text/tertiary — pending design token
  const idleColor = "#5c5d61";

  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Up arrow */}
      <path d="M5 1L9 5H1L5 1Z" fill={sort === "asc" ? "currentColor" : idleColor} />
      {/* Down arrow */}
      <path d="M5 13L1 9H9L5 13Z" fill={sort === "desc" ? "currentColor" : idleColor} />
    </svg>
  );
}
