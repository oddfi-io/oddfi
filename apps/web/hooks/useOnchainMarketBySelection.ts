"use client";

/**
 * DD-118 / DD-117 共建：fixture 上的链上盘口查询 + selection 映射。
 *
 * - `useOnchainMarketsByFixture`：用 React Query 缓存 `/market/onchain?fixture_id=X` 响应
 * - `selectOnchainMarketForEntry`：纯函数 — 给定 sportmonks 的 marketId + 标签 + 盘口线，
 *    返回对应合约 marketId（0x hash）+ outcomeIndex（quotedOdds 数组下标）
 *
 * 单一事实源：上游 fetch 一次，组件按 entry 各自 select。
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getOnchainMarkets } from "@/lib/api";
import { ONCHAIN_MARKETS } from "@/lib/react-query-keys";
import type { OnchainMarket } from "@/types/onchain-betting";

const STALE_MS = 30_000;
const GC_MS = 5 * 60_000;

export interface UseOnchainMarketsByFixtureResult {
  markets: OnchainMarket[] | null;
  isLoading: boolean;
  isError: boolean;
}

/** Fetch all onchain markets for a fixture (cached by fixtureId). */
export function useOnchainMarketsByFixture(
  fixtureId: number | null | undefined
): UseOnchainMarketsByFixtureResult {
  const enabled = typeof fixtureId === "number" && fixtureId > 0;
  const query = useQuery({
    queryKey: enabled ? ONCHAIN_MARKETS(fixtureId) : ["onchain-markets", "disabled"],
    queryFn: () => getOnchainMarkets(fixtureId as number),
    enabled,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
  });

  const markets = useMemo(() => query.data?.markets ?? null, [query.data]);

  return {
    markets,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

// ─── Mapping ─────────────────────────────────────────────────

/**
 * SportMonks market_id → contract market_type code:
 *   1  = Full Time Result (1X2)  → market_type 0
 *   6  = Asian Handicap          → market_type 1
 *   7  = Asian Total (O/U)       → market_type 2
 */
const SPORTMONKS_TO_CONTRACT_TYPE: Record<number, number> = {
  1: 0,
  6: 1,
  7: 2,
};

/**
 * DD-118 line 匹配规则（后端语义对齐 forward-compat）：
 *
 * 后端 `OnchainMarket.line` 是合约 uint8 lineID（0/1/2），无法直接与前端
 * SportMonks line（"-0.5"）匹配。后端补 `line_value` 字段后才能精确匹配。
 *
 * - 字段存在 → 用字符串严格匹配（trim 容错）
 * - 字段缺失（旧后端） → 返回 null，调用方走 REST fallback，**不订阅** WS
 *
 * 详见 `.progress/stash/backend-req-onchain-market-line-encoding.md`。
 */
function lineMatches(m: OnchainMarket, sportmonksLine: string | null | undefined): boolean {
  if (!sportmonksLine) return false;
  if (m.line_value === undefined || m.line_value === null) return false;
  return String(m.line_value).trim() === String(sportmonksLine).trim();
}

/**
 * 把 sportmonks 选项文本 → contract outcome index（即 quotedOdds 数组下标）：
 *   1X2  : Home=0, Draw=1, Away=2
 *   AH   : Home=0, Away=1
 *   Total: Over=0, Under=1
 *
 * 注意：1X2 的 label 是球队名（不是 "Home"/"Away" 字面量），调用方必须先映射回
 * `Home` / `Draw` / `Away` 才能用本函数。
 */
export function selectionLabelToOutcomeIndex(
  contractMarketType: number,
  label: "Home" | "Draw" | "Away" | "Over" | "Under"
): number | null {
  if (contractMarketType === 0) {
    if (label === "Home") return 0;
    if (label === "Draw") return 1;
    if (label === "Away") return 2;
    return null;
  }
  if (contractMarketType === 1) {
    if (label === "Home") return 0;
    if (label === "Away") return 1;
    return null;
  }
  if (contractMarketType === 2) {
    if (label === "Over") return 0;
    if (label === "Under") return 1;
    return null;
  }
  return null;
}

export interface OnchainMarketLookupArgs {
  markets: OnchainMarket[] | null;
  sportmonksMarketId: number; // 1 / 6 / 7
  /** AH/Total 的盘口线（仅 AH/Total 必需，1X2 传 null/undefined） */
  line?: string | null;
  /** 合约选项文本（已规范化到 Home/Draw/Away/Over/Under） */
  outcomeLabel: "Home" | "Draw" | "Away" | "Over" | "Under";
}

export interface OnchainMarketLookupResult {
  /** 合约 marketId hash（0x... 66 chars），找不到为 null */
  marketId: string | null;
  /** quotedOdds 数组下标，找不到为 null */
  outcomeIndex: number | null;
}

/**
 * 找 fixture 链上盘口 → (contract marketId, outcome index)。
 * 找不到任一返回 null（调用方走 REST fallback）。
 */
export function selectOnchainMarketForEntry({
  markets,
  sportmonksMarketId,
  line,
  outcomeLabel,
}: OnchainMarketLookupArgs): OnchainMarketLookupResult {
  if (!markets || markets.length === 0) return { marketId: null, outcomeIndex: null };
  const targetType = SPORTMONKS_TO_CONTRACT_TYPE[sportmonksMarketId];
  if (targetType === undefined) return { marketId: null, outcomeIndex: null };
  // 1X2 无 line 概念，只按 market_type 找；AH/Total 必须靠 line_value 精确匹配（后端发版后才生效）。
  const m = markets.find((x) =>
    targetType === 0 ? x.market_type === 0 : x.market_type === targetType && lineMatches(x, line)
  );
  if (!m) return { marketId: null, outcomeIndex: null };
  const outcomeIndex = selectionLabelToOutcomeIndex(targetType, outcomeLabel);
  return { marketId: m.market_id, outcomeIndex };
}
