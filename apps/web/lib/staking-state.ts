// Staking position state machine — centralized derive (DD-107 Batch 1)
//
// 合约层没有显式状态枚举，只通过 position.active + position.unlockAt 隐式表达：
//   active=true  && unlockAt >  now  → Active   (锁定中)
//   active=true  && unlockAt <= now  → Ready    (到期可解锁)
//   active=false                     → Withdrawn (已退出，含正常退 + 早退)
//
// 早退 vs 正常退仅在 StakeWithdrawn 事件的 `early: bool` 区分，不污染仓位状态机；
// History UI 通过 HistoryRecord.action ("unstake" | "early_unstake") 区分文案。

export const STAKE_POSITION_STATUS = {
  Active: "active",
  Ready: "ready",
  Withdrawn: "withdrawn",
} as const;

export type StakePositionStatus =
  (typeof STAKE_POSITION_STATUS)[keyof typeof STAKE_POSITION_STATUS];

export interface StakePositionRaw {
  /** Contract: position.active */
  active: boolean;
  /** Contract: position.unlockAt (seconds since epoch). Caller converts bigint → number. */
  unlockAt: number;
}

/**
 * Derive UI status from raw on-chain position struct.
 *
 * Pure function. Caller is responsible for `Number(pos.unlockAt)` conversion before passing.
 */
export function derivePositionStatus(
  position: StakePositionRaw,
  nowSec: number = Math.floor(Date.now() / 1000)
): StakePositionStatus {
  if (!position.active) return STAKE_POSITION_STATUS.Withdrawn;
  return position.unlockAt <= nowSec ? STAKE_POSITION_STATUS.Ready : STAKE_POSITION_STATUS.Active;
}
