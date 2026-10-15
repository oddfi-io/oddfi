// DD-082 — Portfolio 状态筛选映射
// 前端单一 FilterStatus 枚举 → 后端 `type` 单参（支持逗号分隔多值）

export type FilterStatus =
  | "all"
  | "bet_all"
  | "bet_cancel"
  | "bet_won"
  | "bet_lost"
  // History only
  | "stake_all"
  | "stake"
  | "unstake"
  | "lp_all"
  | "add_lp"
  | "remove_lp"
  | "claim"
  | "deposit"
  | "withdraw";

export interface FilterApiParams {
  type?: string;
}

export function statusToApiParams(status: FilterStatus): FilterApiParams {
  switch (status) {
    case "all":
      return {};
    case "bet_all":
      return { type: "bet_cancel,bet_won,bet_lost,bet_banner,claim" };
    case "stake_all":
      return { type: "stake,unstake" };
    case "lp_all":
      return { type: "add_lp,remove_lp" };
    case "bet_cancel":
    case "bet_won":
    case "bet_lost":
    case "stake":
    case "unstake":
    case "add_lp":
    case "remove_lp":
    case "claim":
    case "deposit":
    case "withdraw":
      return { type: status };
  }
}
