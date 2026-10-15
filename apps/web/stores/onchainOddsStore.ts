/**
 * DD-118: 链上赔率推送 store（marketId → 最新赔率快照）。
 *
 * 单一事实源 — 所有 odds_updated 推送都经 applyUpdate；compareQuoteVersion 单调过滤
 * 在 store 层做（不在 hook / ws manager 层），保证多个消费者拿到一致结果。
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import { compareQuoteVersion } from "@/lib/onchain/odds-format";
import { normalizeMarketId } from "@/lib/onchain/market-id";

export interface MarketOddsState {
  marketId: string;
  baseOdds: string[];
  quotedOdds: string[];
  signal: 0 | 1 | 2 | 3;
  quoteVersion: number;
  updatedAtSec: number;
  receivedAtMs: number;
  /** 上一帧 quotedOdds，闪烁组件比对方向；首次为 undefined → 不闪 */
  previousQuotedOdds?: string[];
  /** visibility recovery 触发；UI 应降级到 REST 直到下一帧推送覆盖 */
  stale?: boolean;
}

export interface OnchainOddsServerData {
  baseOdds: string[];
  quotedOdds: string[];
  signal: number;
  quoteVersion: number;
  updatedAt: number;
}

interface OnchainOddsState {
  byMarketId: Record<string, MarketOddsState>;
  applyUpdate: (rawMarketId: string, data: OnchainOddsServerData) => void;
  markAllStale: () => void;
  reset: () => void;
}

function isValidSignal(s: number): s is 0 | 1 | 2 | 3 {
  return s === 0 || s === 1 || s === 2 || s === 3;
}

export const onchainOddsStore = create<OnchainOddsState>()(
  subscribeWithSelector((set) => ({
    byMarketId: {},

    applyUpdate: (rawMarketId, data) => {
      let mid: string;
      try {
        mid = normalizeMarketId(rawMarketId);
      } catch {
        // Defensive — ws manager already validates; log + drop.
        console.warn("[onchainOddsStore] applyUpdate received invalid marketId", rawMarketId);
        return;
      }
      if (!Array.isArray(data.baseOdds) || !Array.isArray(data.quotedOdds)) {
        console.warn("[onchainOddsStore] applyUpdate dropping payload with non-array odds", data);
        return;
      }
      if (!isValidSignal(data.signal)) {
        console.warn(
          "[onchainOddsStore] applyUpdate dropping payload with invalid signal",
          data.signal
        );
        return;
      }
      const signal: 0 | 1 | 2 | 3 = data.signal;
      set((state) => {
        const existing = state.byMarketId[mid];
        if (existing && compareQuoteVersion(data.quoteVersion, existing.quoteVersion) <= 0) {
          // stale or duplicate — drop silently.
          return state;
        }
        const next: MarketOddsState = {
          marketId: mid,
          baseOdds: data.baseOdds,
          quotedOdds: data.quotedOdds,
          signal,
          quoteVersion: data.quoteVersion,
          updatedAtSec: data.updatedAt,
          receivedAtMs: Date.now(),
          previousQuotedOdds: existing ? existing.quotedOdds : undefined,
          stale: false,
        };
        return { byMarketId: { ...state.byMarketId, [mid]: next } };
      });
    },

    markAllStale: () => {
      set((state) => {
        const entries = Object.entries(state.byMarketId);
        if (entries.length === 0) return state;
        const next: Record<string, MarketOddsState> = {};
        for (const [mid, v] of entries) {
          next[mid] = v.stale ? v : { ...v, stale: true };
        }
        return { byMarketId: next };
      });
    },

    reset: () => set({ byMarketId: {} }),
  }))
);

/** Selector helper for React components (stable identity per marketId). */
export function selectMarketOdds(mid: string | null | undefined) {
  return (s: OnchainOddsState) => (mid ? (s.byMarketId[mid] ?? null) : null);
}
