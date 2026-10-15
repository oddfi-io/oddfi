"use client";

/**
 * DD-118 Batch 3: 把链上 markets 列表 + 一个 sportmonks 投注项 → 实时显示值。
 *
 * 单一职责：组合 selectOnchainMarketForEntry（找合约 marketId + outcomeIndex）+
 * useOnchainOdds（订阅 WS push）+ 与 fallback REST 值的优先级合并。
 *
 * 返回值供 OddsButton 直接渲染：
 *   - `displayValue`: 显示赔率（rest 模式=sports_all 兜底值；ws 模式=合约 quotedOdds 或快照兜底）
 *   - `flashDirection`: "up" | "down" | null — 显示值变化时非空
 *   - `flashSignature`: 值变更时递增的数字，作为 useEffect 依赖触发闪烁动画
 *   - `isLive`: 是否走的 WS 实时数据（用于 dev 调试；rest 模式恒 false）
 *
 * DD-118 后续（WS 让位）：LIVE_ODDS_SOURCE="rest" 时不订阅 WS，赛中赔率以 sports_all（fallbackValue）
 * 为准——实测链上 quoted_odds 在赛中常被锁盘/无量更新，会与 SportMonks live odds 脱节（后端 Remy 口径）。
 * signal（红灯锁定）仍读链上快照。恢复 WS（改回 "ws"）后回到合约 quotedOdds 优先。
 */

import { useMemo, useRef } from "react";

import { useOnchainOdds } from "@/hooks/useOnchainOdds";
import {
  selectOnchainMarketForEntry,
  type OnchainMarketLookupArgs,
} from "@/hooks/useOnchainMarketBySelection";
import { formatContractOdds } from "@/lib/odds";
import { LIVE_ODDS_SOURCE } from "@/lib/network-mode";
import type { OnchainMarket, SignalLevel } from "@/types/onchain-betting";

export interface UseLiveOddsArgs {
  markets: OnchainMarket[] | null;
  sportmonksMarketId: number;
  line?: string | null;
  outcomeLabel: OnchainMarketLookupArgs["outcomeLabel"];
  /** REST 来源的兜底值（已经过 formatOdds 处理的 2 位小数字符串，如 "2.29" 或 "—"）*/
  fallbackValue: string;
  enabled?: boolean;
}

export interface UseLiveOddsResult {
  displayValue: string;
  flashDirection: "up" | "down" | null;
  flashSignature: number;
  isLive: boolean;
  /**
   * DD-119：该方向当前信号灯（0绿/1黄/2橙/3红）。
   * 订阅成功且非 stale → 取 WS live；否则回退 RQ 快照 market.signal；都无 → null。
   * 信号灯只随链上快照变化，前端不复算。
   */
  signal: SignalLevel | null;
}

/** 比较两个万分位 integer string；空值或非数字回退到 NaN（不闪）。 */
function cmpIntegerStr(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return NaN;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return NaN;
  return na - nb;
}

export function useLiveOddsForEntry(args: UseLiveOddsArgs): UseLiveOddsResult {
  const { markets, sportmonksMarketId, line, outcomeLabel, fallbackValue, enabled = true } = args;

  const restMode = LIVE_ODDS_SOURCE === "rest";

  const lookup = useMemo(
    () => selectOnchainMarketForEntry({ markets, sportmonksMarketId, line, outcomeLabel }),
    [markets, sportmonksMarketId, line, outcomeLabel]
  );

  // WS 让位期间（rest）不订阅：enabled=false → status 恒 idle。
  const { data, status } = useOnchainOdds({
    marketId: lookup.marketId,
    enabled: !restMode && enabled && lookup.marketId != null && lookup.outcomeIndex != null,
  });

  // RQ 快照命中行：signal（红灯锁定）从它派生，rest / ws 模式都用。
  const matched = useMemo(() => {
    if (lookup.marketId == null || !markets) return null;
    return markets.find((m) => m.market_id === lookup.marketId) ?? null;
  }, [markets, lookup.marketId]);

  const snapshotSignal: SignalLevel | null = matched?.signal ?? null;

  // 显示值变化闪烁记忆：存上次显示值 + 方向 + 单调计数。
  // 存方向（而非每帧重算）是为了对 React StrictMode 的双调用 render 幂等：同值再渲染沿用已存 dir/sig，
  // 不会出现"第二次调用把方向重置为 null 但计数已自增"导致闪烁被吞。每个 entry 一个实例，互不串扰。
  const flashRef = useRef<{ last: string | null; dir: "up" | "down" | null; sig: number }>({
    last: null,
    dir: null,
    sig: 0,
  });
  // 对一个新的展示值更新闪烁状态（按 2 位小数数值比较涨跌）；"—" / 非数字不闪。
  const flashFor = (display: string): { dir: "up" | "down" | null; sig: number } => {
    const ref = flashRef.current;
    const n = Number(display);
    if (display !== "—" && Number.isFinite(n) && display !== ref.last) {
      if (ref.last != null) {
        const prev = Number(ref.last);
        if (Number.isFinite(prev) && prev !== n) {
          ref.dir = n > prev ? "up" : "down";
          ref.sig += 1;
        }
      }
      ref.last = display;
    }
    return { dir: ref.dir, sig: ref.sig };
  };

  // ── REST 模式（WS 让位）：赛中以 sports_all（fallbackValue）为准，signal 仍读链上快照 ──
  if (restMode) {
    const { dir, sig } = flashFor(fallbackValue);
    return {
      displayValue: fallbackValue,
      flashDirection: dir,
      flashSignature: sig,
      isLive: false,
      signal: snapshotSignal,
    };
  }

  // ── 以下为 WS 模式（LIVE_ODDS_SOURCE="ws"）原逻辑：合约 quotedOdds 优先，快照 quoted_odds 兜底 ──
  // /market/onchain 返回 WCL 压缩/上浮后的 quoted_odds，与链上成交展示价同口径；
  // 有快照时优先于行情 fallbackValue（SportMonks 价与链上展示价存在偏差）。缺失/非法 → null。
  const rawQuoted =
    lookup.outcomeIndex == null ? undefined : matched?.quoted_odds?.[lookup.outcomeIndex];
  const snapshotQuoted =
    typeof rawQuoted === "number" && rawQuoted > 0 ? formatContractOdds(rawQuoted) : null;

  // 没订阅成功 / data 还没到 / 标记 stale → 回退（快照 quoted_odds 优先，其次行情值）。
  if (status !== "subscribed" || !data || data.stale || lookup.outcomeIndex == null) {
    return {
      displayValue: snapshotQuoted ?? fallbackValue,
      flashDirection: null,
      flashSignature: -1,
      isLive: false,
      signal: snapshotSignal,
    };
  }

  const idx = lookup.outcomeIndex;
  const raw = data.quotedOdds[idx];
  if (raw === undefined) {
    // outcome 越界 — 防御性回退（快照 quoted_odds 优先）
    return {
      displayValue: snapshotQuoted ?? fallbackValue,
      flashDirection: null,
      flashSignature: -1,
      isLive: false,
      signal: snapshotSignal,
    };
  }

  const prevRaw = data.previousQuotedOdds?.[idx];
  const diff = cmpIntegerStr(raw, prevRaw);
  const flashDirection: "up" | "down" | null = !Number.isFinite(diff)
    ? null
    : diff > 0
      ? "up"
      : diff < 0
        ? "down"
        : null;

  return {
    displayValue: formatContractOdds(raw),
    flashDirection,
    flashSignature: data.quoteVersion,
    isLive: true,
    signal: data.signal,
  };
}
