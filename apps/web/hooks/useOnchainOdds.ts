/**
 * DD-118: 订阅链上赔率推送的入口 hook。
 *
 * - 传 marketId + enabled，自动管理 subscribe / unsubscribe（依赖单连接 + refCount）
 * - 返回最新 store 快照（含 previousQuotedOdds，便于闪烁动画）
 * - status 五态：idle / subscribed / invalid / error / disabled
 *
 * 用法：
 *   const { data, status } = useOnchainOdds({ marketId: '0x...', enabled: isOnchain });
 */

import { useEffect, useMemo, useState } from "react";

import {
  onchainOddsStore,
  selectMarketOdds,
  type MarketOddsState,
} from "@/stores/onchainOddsStore";
import { InvalidMarketIdError, normalizeMarketId } from "@/lib/onchain/market-id";
import { oddsWs } from "@/lib/ws/odds-ws";
import { WsDisabledError } from "@/lib/ws/types";

export type OnchainOddsStatus =
  | "idle" // marketId 为空或 enabled=false
  | "subscribed" // 已订阅（有/无数据都算）
  | "invalid" // marketId 非法
  | "error" // 订阅时抛出未知错误
  | "disabled"; // NEXT_PUBLIC_WS_ODDS_URL 缺失

export interface UseOnchainOddsArgs {
  marketId: string | null | undefined;
  enabled?: boolean;
}

export interface UseOnchainOddsResult {
  data: MarketOddsState | null;
  status: OnchainOddsStatus;
}

/**
 * Subscribe to live odds for a marketId. Returns store snapshot + subscription status.
 *
 * Effect re-runs only when marketId / enabled changes — refCount on the singleton
 * makes simultaneous subscribers cheap. Cleanup releases the ref.
 */
export function useOnchainOdds(args: UseOnchainOddsArgs): UseOnchainOddsResult {
  const { marketId, enabled = true } = args;

  // Normalize once per render so selector lookup is consistent with the key the store writes under.
  const normalized = useMemo(() => {
    if (!marketId || !enabled) return null;
    try {
      return normalizeMarketId(marketId);
    } catch {
      return null;
    }
  }, [marketId, enabled]);

  // Initial status — useEffect will switch to "subscribed" after the WS subscribe call
  // returns successfully (or to disabled/error/invalid). Avoid the premature "subscribed"
  // initial value: it would imply we already have a live subscription before useEffect ran.
  const [status, setStatus] = useState<OnchainOddsStatus>(() => {
    if (!enabled || !marketId) return "idle";
    if (!normalized) return "invalid";
    return "idle"; // optimistic-but-honest: not subscribed until effect runs
  });

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    if (!normalized) {
      // Either marketId is empty (idle) or it's malformed (invalid).
      setStatus(marketId ? "invalid" : "idle");
      return;
    }
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = oddsWs.subscribe(normalized);
      setStatus("subscribed");
    } catch (err) {
      if (err instanceof WsDisabledError) {
        setStatus("disabled");
        return;
      }
      if (err instanceof InvalidMarketIdError) {
        setStatus("invalid");
        return;
      }
      console.warn("[useOnchainOdds] subscribe threw —", err);
      setStatus("error");
      return;
    }
    return () => {
      unsubscribe?.();
    };
    // `marketId` excluded intentionally: `normalized` is its memoized derivation, so two
    // different raw marketId values that normalize to the same key (e.g. case-only diff)
    // must NOT trigger a needless unsubscribe + resubscribe cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized, enabled]);

  // Stable selector reference per `normalized` — Zustand subscribeWithSelector relies on
  // selector identity to decide whether to skip notifying this subscriber. Building a fresh
  // selector each render would degrade the middleware to a plain subscribe (re-renders on
  // every other market's update).
  const selector = useMemo(() => selectMarketOdds(normalized), [normalized]);
  const data = onchainOddsStore(selector);

  return { data: data ?? null, status };
}
