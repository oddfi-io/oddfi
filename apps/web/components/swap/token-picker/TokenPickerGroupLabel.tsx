"use client";

import type { ReactNode } from "react";

interface TokenPickerGroupLabelProps {
  children: ReactNode;
}

/**
 * Figma H5 分组标题 "Owned assets" / "Popular"。
 * 12px medium leading-18 text-secondary — 内嵌于列表滚动区顶部。
 */
export default function TokenPickerGroupLabel({ children }: TokenPickerGroupLabelProps) {
  return (
    <div className="px-[8px] py-[4px] text-[12px] font-medium leading-[18px] text-secondary">
      {children}
    </div>
  );
}
