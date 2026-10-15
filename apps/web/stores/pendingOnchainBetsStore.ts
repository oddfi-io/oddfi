import { create } from "zustand";
import type { PortfolioBet } from "@/types/portfolio";
import type { BetSelection } from "@/types/betting";

/**
 * DD-140 — 乐观链上注单状态机：
 *
 *   pending（place_bet relay 200，tx 已提交未确认）
 *     → confirmed（getOnchainOrder 轮询到链上确认 / bet_ready）
 *     → failed（链上 revert：持仓上限 / allowance / 市场关闭 等）
 *
 * 用途：链上 place_bet 中心化接口返回 200 即把注单乐观插入此 store，MyBets 立即
 * 展示并由 usePendingOnchainBets 轮询 getOnchainOrder 推进状态；当后端事件索引把该
 * 注单回填进 portfolio history（onchainBetId 匹配）后，MyBetsView 丢弃乐观记录、转交
 * 后端稳态数据。跨用户不共享（每用户独立 proxy 钱包），纯前端本地态。
 */

export type PendingOnchainBetStatus = "pending" | "confirmed" | "failed";

export interface PendingOnchainBet {
  /** 后端 onchain_tx_orders.order_id —— 主键，轮询 getOnchainOrder + 去重均用它 */
  orderId: number;
  /** place_bet tx_hash（展示 / 调试用） */
  txHash: string;
  /**
   * 原始投注车选项（含 onchain 下注所需 fixtureId/marketType/handicap）。失败重投（B1）时
   * 把它原样加回 betslip 重新提交；其 id 亦作本 pending 单的身份标识。
   */
  selection: BetSelection;
  /** 展示快照（提交时定格）—— MyBetCard 直接渲染，避免后续行情变动影响已下注单 */
  bet: PortfolioBet;
  status: PendingOnchainBetStatus;
  /**
   * status=failed 时的 revert i18n sub-key（相对 `betSlip.error.*`，来自
   * revertKindToI18nKey）。失败卡据此展示原因；undefined 时走通用失败文案。
   */
  failReasonKey?: string;
  /** status=failed 时的 i18n 占位符（来自 formatRevertArgs，如 {allowed,attempted}）；与 failReasonKey 配套 */
  failReasonArgs?: Record<string, string | number>;
  /**
   * 事件索引回填的 BettingPool onchain_bet_id（0x hex）。一旦非空，表示后端已索引该
   * 注单，portfolio history 即将/已包含它 —— MyBetsView 据此与稳态数据去重。
   */
  onchainBetId?: string;
  /** 插入时间戳（ms，调用方传入 Date.now()）—— 列表倒序排序用 */
  createdAt: number;
}

interface PendingOnchainBetsState {
  /** 按 orderId 索引；列表顺序由 createdAt 派生（见 toPendingBetList） */
  byOrderId: Record<number, PendingOnchainBet>;
}

interface PendingOnchainBetsActions {
  /** 插入一笔乐观注单（place_bet 200 后）。同 orderId 覆盖（幂等重试安全） */
  add: (bet: PendingOnchainBet) => void;
  /** 更新某单的状态 / 对账字段；orderId 不存在则忽略 */
  update: (
    orderId: number,
    patch: Partial<
      Pick<PendingOnchainBet, "status" | "failReasonKey" | "failReasonArgs" | "onchainBetId">
    >
  ) => void;
  /** 移除一笔（被 portfolio history 接管 / 用户清理失败卡时） */
  remove: (orderId: number) => void;
  /** 批量移除（一次 set，避免逐个 remove 触发 N 次重渲染）；空数组 / 无命中为 no-op */
  removeMany: (orderIds: number[]) => void;
  /** 清空全部（登出 / 切账号时） */
  clear: () => void;
}

export type PendingOnchainBetsStore = PendingOnchainBetsState & PendingOnchainBetsActions;

export const usePendingOnchainBetsStore = create<PendingOnchainBetsStore>((set) => ({
  byOrderId: {},

  add: (bet) => set((s) => ({ byOrderId: { ...s.byOrderId, [bet.orderId]: bet } })),

  update: (orderId, patch) =>
    set((s) => {
      const existing = s.byOrderId[orderId];
      if (!existing) return s;
      return { byOrderId: { ...s.byOrderId, [orderId]: { ...existing, ...patch } } };
    }),

  remove: (orderId) =>
    set((s) => {
      if (!(orderId in s.byOrderId)) return s;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [orderId]: _dropped, ...rest } = s.byOrderId;
      return { byOrderId: rest };
    }),

  removeMany: (orderIds) =>
    set((s) => {
      if (orderIds.length === 0) return s;
      const drop = new Set(orderIds);
      let changed = false;
      const next: Record<number, PendingOnchainBet> = {};
      for (const [key, bet] of Object.entries(s.byOrderId)) {
        if (drop.has(Number(key))) {
          changed = true;
          continue;
        }
        next[Number(key)] = bet;
      }
      return changed ? { byOrderId: next } : s;
    }),

  clear: () => set({ byOrderId: {} }),
}));

/** 稳定引用 selector：订阅 byOrderId map（消费方用 useMemo + toPendingBetList 派生数组） */
export const selectPendingByOrderId = (s: PendingOnchainBetsStore) => s.byOrderId;

/**
 * 纯函数：byOrderId map → createdAt 倒序数组（最新在前）。
 * 单独抽出而非做成 selector：sort 每次产生新数组引用，直接 `useStore(selector)` 会触发
 * zustand 无谓重渲染；消费方必须 `useMemo(() => toPendingBetList(byOrderId), [byOrderId])`。
 */
export function toPendingBetList(
  byOrderId: Record<number, PendingOnchainBet>
): PendingOnchainBet[] {
  return Object.values(byOrderId).sort((a, b) => b.createdAt - a.createdAt);
}
