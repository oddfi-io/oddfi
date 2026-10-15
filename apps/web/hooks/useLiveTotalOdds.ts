"use client";

/**
 * DD-118 Batch 5c — Live total odds + potential-win for parlay (and single sum) display.
 *
 * For each selection, derives a "live" odds value:
 *   - onchain selection with canonical outcome label + valid lookup + fresh push → live raw → formatted
 *   - everything else (banner / mock-UCL / 1X2 with team-name labels / no chain market / stale) → locked `selection.odds`
 *
 * Returns aggregated totals using these live values. The original `selection.odds` snapshot remains the
 * source of truth at submit time (slippage tolerance preserved); this hook only powers UI display.
 *
 * `hasLiveDeviation` flips true the first time any selection's live odds diverges from its locked snapshot.
 */

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { add, cmp, isValidAmount, mul } from "@/lib/decimal";
import { formatContractOdds } from "@/lib/odds";
import { getOnchainMarkets } from "@/lib/api";
import { ONCHAIN_MARKETS } from "@/lib/react-query-keys";
import { useBetSlipStore } from "@/stores/betSlipStore";
import { onchainOddsStore } from "@/stores/onchainOddsStore";
import { selectOnchainMarketForEntry } from "@/hooks/useOnchainMarketBySelection";
import type { BetSelection } from "@/types/betting";
import type { OnchainMarket } from "@/types/onchain-betting";

const CANONICAL_OUTCOME_LABELS = new Set<string>(["Home", "Draw", "Away", "Over", "Under"]);

function sportmonksMarketIdFor(t: BetSelection["marketType"]): 1 | 6 | 7 {
  if (t === "1x2") return 1;
  if (t === "asian_handicap") return 6;
  return 7;
}

export interface UseLiveTotalOddsResult {
  /** 串单 (mode=multi) 总赔率（live 合并 locked） */
  liveTotalOdds: string;
  /** 当前 mode 下的潜在收益（multi: amount × total，single: Σ amount_i × live_i） */
  livePotentialWin: string;
  /** 任一 selection 的 live 与 locked 不同 → true（UI 可选展示 odds-changed 提示） */
  hasLiveDeviation: boolean;
}

interface StoreSnapshot {
  byMarketId: Record<string, { quotedOdds: string[]; stale?: boolean }>;
}

function deriveLiveValue(
  sel: BetSelection,
  markets: OnchainMarket[] | null,
  store: StoreSnapshot
): { value: string; isLive: boolean } {
  if (!markets || markets.length === 0) return { value: sel.odds, isLive: false };
  if (!CANONICAL_OUTCOME_LABELS.has(sel.selection)) return { value: sel.odds, isLive: false };
  const lookup = selectOnchainMarketForEntry({
    markets,
    sportmonksMarketId: sportmonksMarketIdFor(sel.marketType),
    line: sel.handicap ?? sel.total ?? null,
    outcomeLabel: sel.selection as "Home" | "Draw" | "Away" | "Over" | "Under",
  });
  if (!lookup.marketId || lookup.outcomeIndex == null) return { value: sel.odds, isLive: false };
  const entry = store.byMarketId[lookup.marketId];
  if (!entry || entry.stale) return { value: sel.odds, isLive: false };
  const raw = entry.quotedOdds[lookup.outcomeIndex];
  if (raw === undefined) return { value: sel.odds, isLive: false };
  return { value: formatContractOdds(raw), isLive: true };
}

export function useLiveTotalOdds(): UseLiveTotalOddsResult {
  const selections = useBetSlipStore((s) => s.selections);
  const amounts = useBetSlipStore((s) => s.amounts);
  const mode = useBetSlipStore((s) => s.mode);
  const multiAmount = useBetSlipStore((s) => s.multiAmount);
  const byMarketId = onchainOddsStore((s) => s.byMarketId);

  const uniqueFixtureIds = useMemo(
    () => Array.from(new Set(selections.map((s) => s.fixtureId))),
    [selections]
  );

  const fixtureQueries = useQueries({
    queries: uniqueFixtureIds.map((fid) => ({
      queryKey: ONCHAIN_MARKETS(fid),
      queryFn: () => getOnchainMarkets(fid),
      enabled: typeof fid === "number" && fid > 0,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    })),
  });

  // Build a stable derivation signature so useMemo below only re-runs when data changes.
  const fixtureDataDeps = fixtureQueries.map((q) => q.data?.markets ?? null);

  return useMemo(() => {
    const fixtureMarkets = new Map<number, OnchainMarket[] | null>();
    uniqueFixtureIds.forEach((fid, i) => fixtureMarkets.set(fid, fixtureDataDeps[i] ?? null));

    let total = "1";
    const liveValues: string[] = [];
    let hasDeviation = false;

    for (const sel of selections) {
      const { value, isLive } = deriveLiveValue(sel, fixtureMarkets.get(sel.fixtureId) ?? null, {
        byMarketId,
      });
      liveValues.push(value);
      total = mul(total, value);
      // REV-v3-A M1: 用 decimal 比较而非字符串，避免 "3" vs "3.00" 数值相等被误判变动
      if (isLive && cmp(value, sel.odds) !== 0) hasDeviation = true;
    }

    let potentialWin = "0";
    if (mode === "multi") {
      const amt = isValidAmount(multiAmount) ? multiAmount : "0";
      potentialWin = mul(amt, total);
    } else {
      potentialWin = selections.reduce((acc, sel, i) => {
        const amt = isValidAmount(amounts[sel.id] ?? "") ? amounts[sel.id] : "0";
        return add(acc, mul(amt, liveValues[i]));
      }, "0");
    }

    return { liveTotalOdds: total, livePotentialWin: potentialWin, hasLiveDeviation: hasDeviation };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, amounts, mode, multiAmount, byMarketId, ...fixtureDataDeps]);
}
