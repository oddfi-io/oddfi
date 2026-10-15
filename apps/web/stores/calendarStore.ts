/**
 * Calendar 页 UI 状态（DD-091 §3.6）。
 *
 * 与 marketsLayoutStore 的关系：
 *   - 本 store 只管 Calendar 页内的 UI 状态（筛选 / Stage 滚动 pin / 时区 toggle / 详情打开 fixture_id）
 *   - 详情抽屉的布局收缩（PC 三栏伸缩）仍由 marketsLayoutStore.selectFixture / closeDetail 驱动
 *   - 在 openMatch / closeMatch 内同步调用 marketsLayoutStore，保持单一行为入口
 */
import { create } from "zustand";
import { useMarketsLayoutStore } from "@/stores/marketsLayoutStore";
import type { CalendarStageId } from "@/types/calendar";

export type CalendarTzPref = "UTC" | "local";

interface CalendarState {
  /** Group multi-select（null = 全选 / 默认） */
  selectedGroups: string[] | null;
  /** Date Range filter（null = 整届时间窗 / 默认） */
  dateRange: { start: string; end: string } | null;
  /** 当前 active stage（scroll listener 派生 + tab pin 覆盖） */
  activeStage: CalendarStageId;
  /** 用户主动点 tab 的锁定值，wheel/touchstart/pointerdown 触发释放 */
  pinnedStage: CalendarStageId | null;
  /** 时区偏好；SSR 始终 'UTC'，client hydration 后从 localStorage 读取 */
  tzPref: CalendarTzPref;
  /** 当前打开详情的 fixture_id（与 marketsLayoutStore.selectedFixtureId 同步） */
  openMatchId: number | null;
}

interface CalendarActions {
  setActiveStage: (s: CalendarStageId) => void;
  setPinnedStage: (s: CalendarStageId | null) => void;
  releasePin: () => void;

  setSelectedGroups: (g: string[] | null) => void;
  toggleGroup: (g: string) => void;
  clearGroupFilter: () => void;

  setDateRange: (r: { start: string; end: string } | null) => void;

  setTzPref: (p: CalendarTzPref) => void;

  /** 打开详情：同步 marketsLayoutStore.selectFixture，让现有三栏布局收缩逻辑生效 */
  openMatch: (id: number) => void;
  closeMatch: () => void;
}

export type CalendarStore = CalendarState & CalendarActions;

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  selectedGroups: null,
  dateRange: null,
  activeStage: "group",
  pinnedStage: null,
  tzPref: "UTC",
  openMatchId: null,

  setActiveStage: (s) => {
    // pin 状态下 scroll listener 不能覆盖
    if (get().pinnedStage !== null) return;
    set({ activeStage: s });
  },

  setPinnedStage: (s) => {
    set({ pinnedStage: s });
    if (s !== null) set({ activeStage: s });
  },

  releasePin: () => set({ pinnedStage: null }),

  setSelectedGroups: (g) => set({ selectedGroups: g }),

  toggleGroup: (g) => {
    const cur = get().selectedGroups;
    if (cur === null) {
      // 从全选切到只勾这一个？业务上更合理：从全选开始切「除了 g 之外都勾」逻辑较反直觉
      // 直接切到「仅取消 g」更符合多选 UI 习惯：cur === null 视为全勾，点击表示反选
      // 简化实现：cur === null → 全部展开后移除 g
      // 但需要外部传入完整列表才能展开 — 暂时实现为 cur === null → [g] 单选切换语义
      // 调用方（CalendarFilters）按需用 setSelectedGroups 显式管理全选/全空更稳
      set({ selectedGroups: [g] });
      return;
    }
    if (cur.includes(g)) {
      const next = cur.filter((x) => x !== g);
      set({ selectedGroups: next.length === 0 ? null : next });
    } else {
      set({ selectedGroups: [...cur, g] });
    }
  },

  clearGroupFilter: () => set({ selectedGroups: null }),

  setDateRange: (r) => set({ dateRange: r }),

  setTzPref: (p) => set({ tzPref: p }),

  openMatch: (id) => {
    set({ openMatchId: id });
    useMarketsLayoutStore.getState().selectFixture(id);
  },

  closeMatch: () => {
    set({ openMatchId: null });
    useMarketsLayoutStore.getState().closeDetail();
  },
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectActiveStage = (s: CalendarStore) => s.activeStage;
export const selectPinnedStage = (s: CalendarStore) => s.pinnedStage;
export const selectTzPref = (s: CalendarStore) => s.tzPref;
export const selectOpenMatchId = (s: CalendarStore) => s.openMatchId;
export const selectSelectedGroups = (s: CalendarStore) => s.selectedGroups;
export const selectDateRange = (s: CalendarStore) => s.dateRange;
