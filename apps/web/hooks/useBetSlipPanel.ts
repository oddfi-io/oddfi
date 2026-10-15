"use client";

import { useEffect, useState } from "react";
import { useBetSlipStore, selectSelectionCount, selectActiveTab } from "@/stores/betSlipStore";

/**
 * 详情页 BetSlip 面板本地开关（DD-085 §3.5 决策 #1，2026-04-27 验收 follow-up）
 *
 * 协议：
 *  - selectionCount === 0 → 重置为 open=true，下次有 selection 时正常显示
 *  - selectionCount > 0 + open=true → isOpen=true（挂面板）
 *  - selectionCount > 0 + open=false → isOpen=false（用户 X 关闭后保持隐藏）
 *  - 用户再点任意 Bet → 调用 open() 显式重开
 *    (不能依赖 selectionCount 变化判断：addSelection 对同 selection_id 幂等，count 不会涨)
 *
 * My Bets tab 的内容独立于当前 selections：下注成功后所有 leg 被移除（count=0）但
 * activeTab 已切到 mybets，此时面板需保持挂载展示注单，故 hasContent 同时认 mybets tab。
 */
export function useBetSlipPanel() {
  const selectionCount = useBetSlipStore(selectSelectionCount);
  const activeTab = useBetSlipStore(selectActiveTab);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (selectionCount === 0) setOpen(true);
  }, [selectionCount]);

  const hasContent = selectionCount > 0 || activeTab === "mybets";

  return {
    isOpen: hasContent && open,
    open: () => setOpen(true),
    close: () => setOpen(false),
  };
}
