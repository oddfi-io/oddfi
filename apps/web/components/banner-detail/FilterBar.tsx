"use client";

import { useState } from "react";
import FilterItem, { type FilterSort } from "./FilterItem";

export interface FilterOption {
  key: string;
  label: string;
}

interface Props {
  /** 排序选项；默认 [{ 热度 }, { 赔率 }]
   *  @figma-i18n: 热度 → Hot / 赔率 → Odds — Phase 3 接 i18n 时切 messages/*.json
   */
  options?: FilterOption[];
  /** 默认激活的 key（null = 全部 idle） */
  defaultActiveKey?: string | null;
  /** 默认 sort 状态（仅当 defaultActiveKey 非 null 时生效） */
  defaultSort?: FilterSort;
  /** 状态变化回调：activeKey=null 时表示全部 idle */
  onChange?: (key: string | null, sort: FilterSort) => void;
}

const DEFAULT_OPTIONS: FilterOption[] = [
  { key: "popularity", label: "热度" },
  { key: "odds", label: "赔率" },
];

/**
 * FilterBar：详情页排序筛选条（互斥状态机，DD-085 验收 P3）
 *
 * Figma 节点：[3550:73550](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3550-73550)
 * 行为：同时只能一个 FilterItem 激活
 *  - 在当前 active key 上点击 → 内循环 asc → desc → default
 *  - 切换到另一个 key → 当前 key 重置为 default，新 key 进入 asc
 *
 * 后端不支持 sort/order 参数（已 curl 验证），前端做客户端排序（DD-085 §1 范围外，本组件仅触发 onChange）
 */
export default function FilterBar({
  options = DEFAULT_OPTIONS,
  defaultActiveKey = "popularity",
  defaultSort = "asc",
  onChange,
}: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(defaultActiveKey);
  const [sort, setSort] = useState<FilterSort>(defaultSort);

  const handleItemChange = (clickedKey: string, candidateSort: FilterSort) => {
    if (clickedKey === activeKey) {
      // 在当前 active key 上点击 — 接受 FilterItem cycle 结果
      const nextKey = candidateSort === null ? null : clickedKey;
      setActiveKey(nextKey);
      setSort(candidateSort);
      onChange?.(nextKey, candidateSort);
    } else {
      // 切到另一个 key — 重置进 asc（前 key 自动 idle，因 sort prop 传 null）
      setActiveKey(clickedKey);
      setSort("asc");
      onChange?.(clickedKey, "asc");
    }
  };

  return (
    // H5: px-4 左对齐 gap-[12px]（Figma 3646:135993）；PC: gap-3 无额外 padding（沿用 PC 现有布局）
    <div className="flex gap-[12px] px-4 md:gap-3 md:px-0" data-figma-node="3550:73550">
      {options.map((opt) => (
        <FilterItem
          key={opt.key}
          label={opt.label}
          sort={opt.key === activeKey ? sort : null}
          onChange={(s) => handleItemChange(opt.key, s)}
        />
      ))}
    </div>
  );
}
