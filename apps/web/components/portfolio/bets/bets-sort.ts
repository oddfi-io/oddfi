// 投注页（Active / Settled）共享排序类型
// 字段映射：
//   Bet          → amount       (stake)
//   Potential payout → payout   （后端待加字段，前端先传）
//   Settle time  → created_at

export type BetsSortColumn = "amount" | "payout" | "created_at";

export interface BetsSortState {
  orderBy: BetsSortColumn;
  sort: "asc" | "desc";
}

export const BETS_SORT_DEFAULT: BetsSortState = {
  orderBy: "created_at",
  sort: "desc",
};

// cycle: 非激活 → 该列 desc → 该列 asc → 回默认 (created_at desc)
export function toggleBetsSort(state: BetsSortState, column: BetsSortColumn): BetsSortState {
  if (state.orderBy !== column) return { orderBy: column, sort: "desc" };
  if (state.sort === "desc") return { orderBy: column, sort: "asc" };
  return BETS_SORT_DEFAULT;
}
