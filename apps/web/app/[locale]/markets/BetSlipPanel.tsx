"use client";

import { useCallback } from "react";
import BetSlip from "@/components/bet-slip/BetSlip";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import { useLayoutState } from "@/stores/marketsLayoutStore";

/**
 * 右栏 BetSlip + AI Chat dock slot 兄弟容器（DD-108 §3.3/§3.5）。
 *
 * dock slot 始终挂载但样式三态：
 *   - !dock → hidden（脱离 flex 流，避免父 gap-6 残留 24px 空白）
 *   - dock + betslip → 50/50 固定高度
 *   - dock + !betslip → 撑满整列（用户没触发 BetSlip 直接点 fab 的入口）
 */
export default function BetSlipPanel() {
  const isDocked = useAiChatSessionStore((s) => s.mode === "dock");
  const setDockSlotEl = useAiChatSessionStore((s) => s.setDockSlotEl);
  const layoutState = useLayoutState();
  const hasBetslip = layoutState === "betslip" || layoutState === "betslip-only";

  const slotClassName = !isDocked
    ? "hidden"
    : hasBetslip
      ? "shrink-0 h-[min(533px,50vh)]"
      : "flex-1 min-h-0";

  // ref callback：BetSlipPanel mount → 注册 slot 节点；unmount/!dock → 清理。
  // 替代 AiChatModal 用 `[mode, pathname]` effect + rAF 查询的方案，避免
  // MarketsPageClient（dynamic ssr:false）异步挂载时 rAF 拿到 null 后永久卡死。
  const slotRef = useCallback(
    (el: HTMLDivElement | null) => {
      setDockSlotEl(isDocked ? el : null);
    },
    [isDocked, setDockSlotEl]
  );

  return (
    <>
      {hasBetslip && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide">
          <BetSlip />
        </div>
      )}
      <div id="ai-chat-dock-slot" ref={slotRef} aria-hidden={!isDocked} className={slotClassName} />
    </>
  );
}
