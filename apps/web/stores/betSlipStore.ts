import { create } from "zustand";
import { add, mul, isValidAmount } from "@/lib/decimal";
import { toastError } from "@/lib/toast";
import { MIN_BET_ODD } from "@/lib/betting/constants";
import type { BetSelection, BetSettings } from "@/types/betting";

interface BetSlipState {
  selections: BetSelection[];
  mode: "single" | "multi";
  amounts: Record<string, string>;
  multiAmount: string;
  settings: BetSettings;
  isOpen: boolean;
  isSettingsOpen: boolean;
  newestSelectionId: string | null;
  pendingRemovalId: string | null;
  focusAfterRemovalId: string | null;
  activeTab: "betslip" | "mybets";
  /** DD-117 — 每个 selection 的信号灯禁用状态（red/degraded/error/loading 时为 true）；BetCard 写入，BetSummary 读取 */
  signalDisabledById: Record<string, boolean>;
  /** DD-119 P2 — Betslip 底部告警条（异常态：超时/网络 err，链上拥堵等 warn）；BetSummary 写入，footer 渲染 */
  betAlert: { variant: "warn" | "err"; message: string } | null;
  /** DD-119 P2 — 部分成交结果（按 selection）：实际成交/原下注/剩余未扣款（均为 ODD 显示字符串）。BetCard 卡下文案渲染 */
  partialFillById: Record<string, { accepted: string; origin: string; remain: string }>;
}

interface BetSlipActions {
  /** enableBet 默认 true；false 时拒绝加入并 toast "Betting closed"（DD-087 §4.1） */
  addSelection: (selection: BetSelection, enableBet?: boolean) => void;
  removeSelection: (id: string) => void;
  /** enableBet 默认 true；false 时 addSelection 会被拦截（DD-087 §4.1） */
  toggleSelection: (selection: BetSelection, enableBet?: boolean) => void;
  clearAll: () => void;
  setMode: (mode: "single" | "multi") => void;
  setAmount: (selectionId: string, amount: string) => void;
  setMultiAmount: (amount: string) => void;
  updateSettings: (patch: Partial<BetSettings>) => void;
  setOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  clearNewest: () => void;
  requestRemoval: (id: string) => void;
  confirmRemoval: () => void;
  clearFocusAfterRemoval: () => void;
  setActiveTab: (tab: "betslip" | "mybets") => void;
  /** DD-117 — BetCard 上报本 selection 是否应禁用 submit；不再需要时（blur/clear）传 false */
  setSignalDisabled: (selectionId: string, disabled: boolean) => void;
  /** DD-119 P2 — 设置/清除底部告警条；传 null 清除（重试 / 新提交 / 清空投注单时） */
  setBetAlert: (alert: { variant: "warn" | "err"; message: string } | null) => void;
  /** DD-119 P2 — 设置/清除某 selection 的部分成交结果；传 null 清除 */
  setPartialFill: (
    selectionId: string,
    info: { accepted: string; origin: string; remain: string } | null
  ) => void;
}

export type BetSlipStore = BetSlipState &
  BetSlipActions & {
    totalOdds: () => string;
    totalBet: () => string;
    potentialWin: () => string;
    hasConflict: () => boolean;
  };

const DEFAULT_SETTINGS: BetSettings = {
  oddsAcceptance: "any",
};

export const useBetSlipStore = create<BetSlipStore>((set, get) => ({
  selections: [],
  mode: "single",
  amounts: {},
  multiAmount: "",
  settings: DEFAULT_SETTINGS,
  isOpen: false,
  isSettingsOpen: false,
  newestSelectionId: null,
  pendingRemovalId: null,
  focusAfterRemovalId: null,
  activeTab: "betslip" as const,
  signalDisabledById: {},
  betAlert: null,
  partialFillById: {},

  addSelection: (selection, enableBet = true) => {
    // 赛事级禁投守门（DD-087 §4.1）：enableBet=false 时拒绝加入并提示
    if (!enableBet) {
      toastError("Betting closed");
      return;
    }
    set((s) => {
      if (s.selections.some((sel) => sel.id === selection.id)) return s;
      return {
        selections: [...s.selections, selection],
        amounts: { ...s.amounts, [selection.id]: String(MIN_BET_ODD) },
        isOpen: true,
        newestSelectionId: selection.id,
        activeTab: "betslip" as const,
      };
    });
  },

  removeSelection: (id) =>
    set((s) => {
      const next = s.selections.filter((sel) => sel.id !== id);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _removed, ...restAmounts } = s.amounts;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _droppedSignal, ...restSignal } = s.signalDisabledById;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _droppedPartial, ...restPartial } = s.partialFillById;
      return {
        selections: next,
        amounts: restAmounts,
        signalDisabledById: restSignal,
        partialFillById: restPartial,
        // 删卡后清除底部告警条，避免提交失败告警在投注单内容已变时残留（REV-v1-A m-03）
        betAlert: null,
        isOpen: next.length > 0 ? s.isOpen : false,
      };
    }),

  toggleSelection: (selection, enableBet = true) => {
    const { selections } = get();
    if (selections.some((sel) => sel.id === selection.id)) {
      get().removeSelection(selection.id);
    } else {
      get().addSelection(selection, enableBet);
    }
  },

  clearAll: () =>
    set({
      selections: [],
      amounts: {},
      multiAmount: "",
      signalDisabledById: {},
      betAlert: null,
      partialFillById: {},
    }),

  setSignalDisabled: (selectionId, disabled) =>
    set((s) => {
      const prev = s.signalDisabledById[selectionId] ?? false;
      if (prev === disabled) return s; // 跳过无变化的写入避免触发订阅者重渲染
      if (!disabled) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [selectionId]: _dropped, ...rest } = s.signalDisabledById;
        return { signalDisabledById: rest };
      }
      return { signalDisabledById: { ...s.signalDisabledById, [selectionId]: true } };
    }),

  setBetAlert: (betAlert) => set({ betAlert }),

  setPartialFill: (selectionId, info) =>
    set((s) => {
      if (info === null) {
        if (!(selectionId in s.partialFillById)) return s;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [selectionId]: _dropped, ...rest } = s.partialFillById;
        return { partialFillById: rest };
      }
      return { partialFillById: { ...s.partialFillById, [selectionId]: info } };
    }),

  setMode: (mode) => set({ mode }),

  setAmount: (selectionId, amount) =>
    set((s) => {
      // 用户改金额 → 旧部分成交结果失效（清除卡下文案）。
      // 注意：部分成交回填须「先 setAmount(剩余) 再 setPartialFill(info)」，否则会被这里清掉。
      if (!(selectionId in s.partialFillById)) {
        return { amounts: { ...s.amounts, [selectionId]: amount } };
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [selectionId]: _dropped, ...restPartial } = s.partialFillById;
      return { amounts: { ...s.amounts, [selectionId]: amount }, partialFillById: restPartial };
    }),

  setMultiAmount: (multiAmount) => set({ multiAmount }),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  setOpen: (isOpen) => set({ isOpen }),

  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),

  clearNewest: () => set({ newestSelectionId: null }),

  requestRemoval: (id) => set({ pendingRemovalId: id }),

  confirmRemoval: () => {
    const { pendingRemovalId, selections } = get();
    if (!pendingRemovalId) return;
    const idx = selections.findIndex((s) => s.id === pendingRemovalId);
    const remaining = selections.filter((s) => s.id !== pendingRemovalId);
    const focusId =
      remaining.length > 0
        ? idx > 0
          ? remaining[Math.min(idx - 1, remaining.length - 1)].id
          : remaining[0].id
        : null;
    get().removeSelection(pendingRemovalId);
    set({ pendingRemovalId: null, focusAfterRemovalId: focusId });
  },

  clearFocusAfterRemoval: () => set({ focusAfterRemovalId: null }),

  setActiveTab: (activeTab) => set({ activeTab }),

  totalOdds: () => {
    const { selections } = get();
    if (selections.length === 0) return "0";
    return selections.reduce((acc, sel) => mul(acc, sel.odds), "1");
  },

  totalBet: () => {
    const { mode, selections, amounts, multiAmount } = get();
    if (mode === "multi") return multiAmount || "0";
    return selections.reduce((sum, sel) => {
      const amt = amounts[sel.id] || "0";
      return isValidAmount(amt) ? add(sum, amt) : sum;
    }, "0");
  },

  potentialWin: () => {
    const { mode, selections, amounts, multiAmount } = get();
    if (mode === "multi") {
      const totalOdds = get().totalOdds();
      const amt = isValidAmount(multiAmount) ? multiAmount : "0";
      return mul(amt, totalOdds);
    }
    return selections.reduce((sum, sel) => {
      const amt = amounts[sel.id] || "0";
      if (!isValidAmount(amt)) return sum;
      return add(sum, mul(amt, sel.odds));
    }, "0");
  },

  hasConflict: () => {
    const { selections } = get();
    const seen = new Set<number>();
    for (const sel of selections) {
      if (seen.has(sel.fixtureId)) return true;
      seen.add(sel.fixtureId);
    }
    return false;
  },
}));

export const selectSelectionCount = (s: BetSlipStore) => s.selections.length;
export const selectIsSelected = (id: string) => (s: BetSlipStore) =>
  s.selections.some((sel) => sel.id === id);
export const selectHasConflict = (s: BetSlipStore) => s.hasConflict();
export const selectTotalOdds = (s: BetSlipStore) => s.totalOdds();
export const selectTotalBet = (s: BetSlipStore) => s.totalBet();
export const selectPotentialWin = (s: BetSlipStore) => s.potentialWin();
export const selectActiveTab = (s: BetSlipStore) => s.activeTab;
