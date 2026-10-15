// LP 数据刷新协调 — DD-092 后续修复
// ASSETS.md 已查（关键词 lpRefetch / refetchStore / lp-refetch / deposit.bump）：无替代品。
// 新建理由：deposit/withdraw/unbond 成功后需要协调多个 hook（useLpPositions /
// useLiquidityPoolStats）同时进入 loading 态并 refetch，避免用户看到旧数据闪烁。
import { create } from "zustand";

interface LpRefetchStore {
  /** 单调递增的 bump key — hook useEffect 监听其变化触发 refetch */
  bumpKey: number;
  /** 标记数据 stale 并触发所有订阅 hook 重拉 */
  bump: () => void;
  /**
   * 同步态（DD-130 问题2）：deposit 成功后链下索引器回填 positions 有 ~10s 延迟。
   * 置 true 后 PoolsPage 自动切到 Positions tab，PositionTable 显示骨架占位 +
   * 提速轮询，直到新仓位入库（PositionTable 判定后调 stopSync）或超时。
   */
  syncing: boolean;
  startSync: () => void;
  stopSync: () => void;
}

export const useLpRefetchStore = create<LpRefetchStore>((set) => ({
  bumpKey: 0,
  bump: () => set((s) => ({ bumpKey: s.bumpKey + 1 })),
  syncing: false,
  startSync: () => set({ syncing: true }),
  stopSync: () => set({ syncing: false }),
}));
