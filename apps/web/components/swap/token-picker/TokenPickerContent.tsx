"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import { useTokenPickerSource } from "@/hooks/useTokenPickerSource";
import TokenPickerChainTabs from "./TokenPickerChainTabs";
import TokenPickerList from "./TokenPickerList";
import TokenPickerSearchInput from "./TokenPickerSearchInput";
import type { PickerFilter, PickerItem, PickerSection } from "./types";

interface TokenPickerContentProps {
  /** 当前已选 token id（用于高亮），由外层 SwapCard 从 fromToken/toToken 映射 */
  selectedId?: string;
  /** 另一侧已选中的 token id（防冲突），命中则行灰化不可点 */
  disabledId?: string;
  onSelect: (item: PickerItem) => void;
}

/**
 * PC / H5 共用内容区（搜索 + 链 Tab + 列表）。
 * 数据源：`useTokenPickerSource`（Pay/Receive 共享，DD-078 §3.2）。
 * 差异仅在搜索框尺寸（PC md / H5 sm）。
 */
export default function TokenPickerContent({
  selectedId,
  disabledId,
  onSelect,
}: TokenPickerContentProps) {
  const t = useTranslations("swap.tokenPicker");
  const mode = useResponsiveMode();
  const isH5 = mode === "h5";

  const [filter, setFilter] = useState<PickerFilter>({
    search: "",
    chainId: "all",
  });

  const { sections: rawSections, chainTabs } = useTokenPickerSource();

  const sections = useMemo<PickerSection[]>(
    () => filterSections(rawSections, filter),
    [rawSections, filter]
  );

  const ownedLabel = t("ownedAssets");

  return (
    <div className="flex flex-col gap-[16px]">
      <TokenPickerSearchInput
        size={isH5 ? "sm" : "md"}
        value={filter.search}
        onChange={(search) => setFilter((f) => ({ ...f, search }))}
        placeholder={t("searchPlaceholder")}
      />
      <TokenPickerChainTabs
        tabs={chainTabs}
        active={filter.chainId}
        onChange={(chainId) => setFilter((f) => ({ ...f, chainId }))}
      />
      <TokenPickerList
        sections={sections}
        selectedId={selectedId}
        disabledId={disabledId}
        onSelect={onSelect}
        ownedLabel={ownedLabel}
        emptyText={t("noTokensFound")}
      />
    </div>
  );
}

/** 纯函数：按搜索词 + 链 Tab 过滤 sections（保留分组壳，内容可为空） */
function filterSections(sections: PickerSection[], filter: PickerFilter): PickerSection[] {
  const q = filter.search.trim().toLowerCase();
  return sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (filter.chainId !== "all" && item.chainId !== filter.chainId) {
        return false;
      }
      if (!q) return true;
      return item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
    }),
  }));
}
