"use client";

import { memo } from "react";
import SortIcon from "@/components/icons/SortIcon";

// 排序表头 — Figma node 1689:80116 head symbol
// 规格：gap-[4px] items-center px-[16px] h-full + 14px secondary label + 20×20 SortIcon
// 激活态 label 用 text-primary，非激活用 text-secondary

interface Props<Column extends string> {
  label: string;
  column: Column;
  activeColumn: Column | undefined;
  sort: "asc" | "desc";
  onToggle: (column: Column) => void;
  className?: string;
}

function SortHeader<Column extends string>({
  label,
  column,
  activeColumn,
  sort,
  onToggle,
  className,
}: Props<Column>) {
  const active = activeColumn === column;
  const state = !active ? "inactive" : sort;
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      aria-label={`Sort by ${label}`}
      style={{ touchAction: "manipulation" }}
      className={`flex items-center gap-[4px] px-[16px] h-full bg-transparent border-0 cursor-pointer text-left ${className ?? ""}`}
    >
      <span
        className={`text-[14px] font-normal leading-[19px] whitespace-nowrap ${active ? "text-primary" : "text-secondary"}`}
      >
        {label}
      </span>
      {/* Figma: 20×20 icon 容器，内部 10×12 箭头居中 */}
      <span className="inline-flex items-center justify-center size-[20px] shrink-0">
        <SortIcon state={state} />
      </span>
    </button>
  );
}

export default memo(SortHeader) as typeof SortHeader;
