"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * NumberedSection — 「N. 标题」+ 副标题 + children 的通用表单分段（Figma 6404:87859/87907/87912）。
 *
 * Wizard Step 2/3 多个字段共用同一头部布局，避免重复手抄 list-decimal/ms-24 等结构。
 * 使用 native semantics：`<section>` + `<h3>`；副标题用 `<p>`。
 */
export interface NumberedSectionProps {
  index: number;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 隐藏「N.」编号前缀（DD-135 H5 设置页设计稿标题无编号，仅 PC wizard 显示）。 */
  hideIndex?: boolean;
}

export default function NumberedSection({
  index,
  title,
  subtitle,
  children,
  className,
  hideIndex = false,
}: NumberedSectionProps) {
  return (
    <section className={cn("flex w-full flex-col gap-4", className)}>
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-medium leading-6 text-primary">
          {!hideIndex && <span className="mr-1.5">{index}.</span>}
          {title}
        </h3>
        {subtitle && <p className="text-xs leading-[18px] text-tertiary">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}
