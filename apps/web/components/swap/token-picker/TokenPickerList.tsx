"use client";

import TokenPickerGroupLabel from "./TokenPickerGroupLabel";
import TokenPickerRow from "./TokenPickerRow";
import type { PickerItem, PickerSection } from "./types";

interface TokenPickerListProps {
  sections: PickerSection[];
  selectedId?: string;
  /** 另一侧已选中的 token id（`${chainId}:${symbol}`），命中则行变灰不可点 */
  disabledId?: string;
  onSelect: (item: PickerItem) => void;
  /** 本地化后的 Owned 分组标题 — 用于匹配 variant="owned" 渲染 */
  ownedLabel: string;
  /** 空列表占位文案（已本地化） */
  emptyText: string;
}

/**
 * 滚动列表容器 — sections 顺序：
 * · label === ownedLabel → 行使用 variant="owned"（右侧余额列）
 * · 其它（含 label undefined）→ variant="default"
 * PC 形态传单 section (无 label)；H5 传 Owned + Popular 两 section。
 */
export default function TokenPickerList({
  sections,
  selectedId,
  disabledId,
  onSelect,
  ownedLabel,
  emptyText,
}: TokenPickerListProps) {
  const hasAny = sections.some((s) => s.items.length > 0);

  if (!hasAny) {
    return (
      <div className="py-[40px] text-center text-[14px] leading-[19px] text-secondary">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {sections.map((section, idx) => {
        if (section.items.length === 0) return null;
        // 优先取 section.variant（平台币置顶分组用）；否则按 label 是否为 ownedLabel 判定
        const variant = section.variant ?? (section.label === ownedLabel ? "owned" : "default");
        return (
          <div key={section.label ?? `unlabeled-${idx}`} className="flex flex-col">
            {section.label && <TokenPickerGroupLabel>{section.label}</TokenPickerGroupLabel>}
            {section.items.map((item) => (
              <TokenPickerRow
                key={item.id}
                item={item}
                variant={variant}
                selected={selectedId === item.id}
                disabled={disabledId === item.id || !!item.disabled}
                onClick={onSelect}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
