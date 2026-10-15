// 链上交易全局互斥锁 — DD-107 增量
// ASSETS.md 已查（关键词 tx / lock / pending / transaction）：无替代品。
// 新建理由：钱包同一时刻只能签一笔交易。多按钮共存时（StakeTab.Stake、PositionCard.Unstake、
// EarlyUnstakeModal.Confirm 等），需要全局唯一 pending 标志屏蔽其他按钮，避免用户唤出钱包后
// 仍能点其他按钮触发竞态。各 tx hook（useStakeTx / useUnstakeTx / ...）在 approving /
// staking / confirming 阶段 lock，success / failed / reset 时 unlock。
import { create } from "zustand";

export type TxLockKind = "stake" | "unstake" | "earlyUnstake" | "tiersale";

interface TxLockStore {
  isLocked: boolean;
  lockedBy: TxLockKind | null;
  lock: (kind: TxLockKind) => void;
  unlock: () => void;
}

export const useTxLockStore = create<TxLockStore>((set) => ({
  isLocked: false,
  lockedBy: null,
  lock: (kind) => set({ isLocked: true, lockedBy: kind }),
  unlock: () => set({ isLocked: false, lockedBy: null }),
}));

/** 是否被 *其他* 类型 tx 锁住。selector 返回 boolean，引用相等天然去重。
 *  自身正在执行（lockedBy === selfKind）不算被锁，按钮内部会用自身 phase 渲染 spinner。 */
export function useIsTxLockedByOther(selfKind: TxLockKind): boolean {
  return useTxLockStore((s) => s.isLocked && s.lockedBy !== selfKind);
}
