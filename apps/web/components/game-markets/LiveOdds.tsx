"use client";

/**
 * DD-118 Batch 5b — Render-prop wrapper that binds a button-like child to a
 * live odds source. Pairs `useLiveOddsForEntry` (subscribes via WS) with a ref
 * + WAAPI flash on quoteVersion change. Falls back to `fallbackValue` if no
 * onchain market exists for the entry OR `enabled` is false (viewport gate).
 *
 * Usage:
 *   <LiveOdds markets={onchain} sportmonksMarketId={1} outcomeLabel="Home"
 *             fallbackValue={display.col1} enabled={isVisible}>
 *     {(value, ref) => (
 *       <div ref={ref}><OddsBtn value={value} ... /></div>
 *     )}
 *   </LiveOdds>
 */

import { useEffect, useRef } from "react";
import {
  useLiveOddsForEntry,
  type UseLiveOddsArgs,
  type UseLiveOddsResult,
} from "@/hooks/useLiveOddsForEntry";
import { flashOddsDirection } from "@/lib/betslip-animations";

interface LiveOddsRenderProps extends UseLiveOddsArgs {
  children: (
    value: string,
    ref: React.RefObject<HTMLDivElement | null>,
    meta: { isLive: boolean; locked: boolean }
  ) => React.ReactElement;
}

export function LiveOdds({ children, ...args }: LiveOddsRenderProps) {
  const live: UseLiveOddsResult = useLiveOddsForEntry(args);
  const ref = useRef<HTMLDivElement | null>(null);
  const locked = live.signal === 3; // DD-119 红灯：停止接单，赔率格锁定为 "--"

  useEffect(() => {
    // 红灯锁定时显示 "--"，不跑赔率刷新动画。
    // 闪烁只取决于"赔率值是否变化"（flashDirection + signature），不绑定数据来源是否为 WS——
    // REST 轮询路径同样会在 quoted_odds 变化时给出方向，故此处不再判 isLive。
    if (locked || !live.flashDirection || live.flashSignature < 0) return;
    const el = ref.current;
    if (!el) return;
    flashOddsDirection(el, live.flashDirection);
  }, [live.flashSignature, live.flashDirection, locked]);

  return children(live.displayValue, ref, { isLive: live.isLive, locked });
}
