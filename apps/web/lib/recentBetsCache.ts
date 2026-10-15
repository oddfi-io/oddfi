import type { BetSelection, PlaceBetResult } from "@/types/betting";

const RECENT_BETS_KEY = "oddfi_recent_bets";

export interface BetSelectionSnapshot {
  fixtureName: string;
  displayLabel: string;
  odds: string;
  marketType: string;
  leagueName: string;
  selection: string;
  betId: number;
}

type RecentBetsCache = Record<number, BetSelectionSnapshot>;

export function loadRecentBets(): RecentBetsCache {
  try {
    const raw = localStorage.getItem(RECENT_BETS_KEY);
    return raw ? (JSON.parse(raw) as RecentBetsCache) : {};
  } catch {
    return {};
  }
}

function saveRecentBets(cache: RecentBetsCache): void {
  try {
    localStorage.setItem(RECENT_BETS_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("[recentBetsCache] Failed to save — localStorage may be full", e);
  }
}

export function cacheSuccessfulBets(results: PlaceBetResult[], selections: BetSelection[]): void {
  const cache = loadRecentBets();
  for (const r of results) {
    if (r.status === "SUCCESS") {
      const sel = selections.find((s) => s.oddId === r.odd_id);
      if (sel) {
        cache[r.odd_id] = {
          fixtureName: sel.fixtureName,
          displayLabel: sel.displayLabel,
          odds: sel.odds,
          marketType: sel.marketType,
          leagueName: sel.leagueName,
          selection: sel.selection,
          betId: r.bet_id,
        };
      }
    }
  }
  saveRecentBets(cache);
}

export function getSnapshotByOddId(oddId: number): BetSelectionSnapshot | undefined {
  const cache = loadRecentBets();
  return cache[oddId];
}
