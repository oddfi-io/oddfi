import { create } from "zustand";

/**
 * ENH-038 — 链上撤单（cash out）乐观「正在取消」标记（前身 BUG-024 cashedOutBetsStore，语义已切换）。
 *
 * 后端 cash_out relay 异步只返回 tx_hash。撤单 receipt 确认成功后，后端 history 的 cash_out_state
 * 要等下一次 refetch 才翻 `cashing_out`（web-api 已**同步**落 op='cash_out' 订单，故仅差一个 refetch 往返）。
 * 这段窗口内 history 仍返回旧数据（`cash_out_state` 缺省 = none、Cancel 可点）→ 用户可能再点一次
 * → 第二笔 cash_out 链上 revert（合约保证只兑现一次，sponsor 白付 gas）。
 *
 * 本 store 作为**0 延迟桥接**：`submitOnchainCashout` **等 receipt**、明确知道撤单链上成功后，把
 * onchainBetId 记入本 store。MyBets / Portfolio active 列表据此**乐观地把该单标为 cashing_out**
 * （按钮禁用 + 显示「正在取消」，而非隐藏），直到后端 `cash_out_state` 回写接管。链上 revert 走 onError，
 * 不记入 → 不会误禁用仍有效的单。
 *
 * 后端 `cash_out_state` 回写为 `cashing_out`（桥接完成）或该 betId 翻 CASHED_OUT 离开 active 后，
 * 由消费方 prune 清理，避免内存累积。纯前端本地态，跨用户不共享（每用户独立 proxy 钱包）。
 */

interface CashingOutBetsState {
  /** 已乐观「正在取消」的 onchainBetId 集合（0x hex），用 map 取代 Set 以便 zustand 稳定订阅 */
  byBetId: Record<string, true>;
}

interface CashingOutBetsActions {
  /** receipt 确认撤单成功后调用，乐观标记该 betId 正在取消 */
  markCashingOut: (onchainBetId: string) => void;
  /** 批量清理（后端已回写 cashing_out 接管、或 betId 翻 CASHED_OUT 离开 active 后）；空数组 / 无命中为 no-op */
  removeMany: (onchainBetIds: string[]) => void;
  /** 清空全部（登出 / 切账号时） */
  clear: () => void;
}

export type CashingOutBetsStore = CashingOutBetsState & CashingOutBetsActions;

export const useCashingOutBetsStore = create<CashingOutBetsStore>((set) => ({
  byBetId: {},

  markCashingOut: (onchainBetId) =>
    set((s) => {
      const id = onchainBetId.trim();
      if (!id || s.byBetId[id]) return s;
      return { byBetId: { ...s.byBetId, [id]: true } };
    }),

  removeMany: (onchainBetIds) =>
    set((s) => {
      if (onchainBetIds.length === 0) return s;
      const drop = new Set(onchainBetIds);
      let changed = false;
      const next: Record<string, true> = {};
      for (const id of Object.keys(s.byBetId)) {
        if (drop.has(id)) {
          changed = true;
          continue;
        }
        next[id] = true;
      }
      return changed ? { byBetId: next } : s;
    }),

  clear: () => set({ byBetId: {} }),
}));

/** 稳定引用 selector：订阅 byBetId map（消费方用 `id in map` 判断是否乐观正在取消） */
export const selectCashingOutByBetId = (s: CashingOutBetsStore) => s.byBetId;
