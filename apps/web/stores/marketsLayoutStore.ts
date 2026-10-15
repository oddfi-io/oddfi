import { create } from "zustand";
import { useBetSlipStore } from "@/stores/betSlipStore";
import type { TournamentKey } from "@/config/featured/tournament-stages";

// Legacy types (inlined from removed league-category.ts)
export type CategoryKey =
  | "all"
  | "worldcup"
  | "ucl"
  | "other"
  | "england"
  | "spain"
  | "italy"
  | "germany"
  | "france";
export type ChipKey = "all" | "live" | "hot" | "qualifiers" | "finals";

// ─── V2 filter types (DD-052) ────────────────────────────────────────────
export type TimeFilter = "all" | "live" | "today" | "tomorrow" | "calendar";
// DD-market-chips：team chip 由队名(string) 改为 team_id(number)，供服务端过滤
export type TeamFilter = number | null;

// State
interface MarketsLayoutState {
  selectedFixtureId: number | null;
  sidebarCollapsed: boolean;
  sidebarUserPreference: boolean;

  // Legacy fields (used by existing components until Batch 6a migration)
  selectedCategory: CategoryKey;
  selectedChip: ChipKey;

  // V2 fields (DD-052)
  selectedTournament: TournamentKey;
  selectedTimeFilter: TimeFilter;
  selectedTeamFilter: TeamFilter;
  calendarDate: string | null;

  // DD-083: Other Tab 内的国家分组 chip（SportMonks country_id）
  selectedLeagueCountryId: number | null;
}

// Actions
interface MarketsLayoutActions {
  selectFixture: (id: number) => void;
  closeDetail: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  // Legacy actions
  setSelectedCategory: (key: CategoryKey) => void;
  setSelectedChip: (key: ChipKey) => void;

  // V2 actions (DD-052)
  setSelectedTournament: (key: TournamentKey) => void;
  setSelectedTimeFilter: (filter: TimeFilter) => void;
  setSelectedTeamFilter: (team: TeamFilter) => void;
  setCalendarDate: (date: string | null) => void;

  // DD-083
  setSelectedLeagueCountryId: (countryId: number | null) => void;
}

export type MarketsLayoutStore = MarketsLayoutState & MarketsLayoutActions;

export const useMarketsLayoutStore = create<MarketsLayoutStore>((set) => ({
  // State
  selectedFixtureId: null,
  sidebarCollapsed: false,
  sidebarUserPreference: false,
  selectedCategory: "all",
  selectedChip: "all",

  // V2 state defaults
  selectedTournament: "worldcup",
  selectedTimeFilter: "all",
  selectedTeamFilter: null,
  calendarDate: null,
  selectedLeagueCountryId: null,

  // Actions
  selectFixture: (id) => set({ selectedFixtureId: id }),

  closeDetail: () =>
    set((s) => ({
      selectedFixtureId: null,
      sidebarCollapsed: s.sidebarUserPreference,
    })),

  toggleSidebar: () =>
    set((s) => ({
      sidebarCollapsed: !s.sidebarCollapsed,
      sidebarUserPreference: !s.sidebarCollapsed,
    })),

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  // Legacy actions
  setSelectedCategory: (key) => set({ selectedCategory: key }),
  setSelectedChip: (key) => set({ selectedChip: key }),

  // V2 actions — with cascade reset rules (DD-052 §3.2 + DD-083 §3.2)
  setSelectedTournament: (key) =>
    set({
      selectedTournament: key,
      selectedTeamFilter: null,
      // 离开 Other Tab 时清空国家 chip；回到 Other Tab 保留用户上次选择
      ...(key !== "other" ? { selectedLeagueCountryId: null } : {}),
      // 进入 Other Tab 默认 today（后端 sports_all?league=0 当前会回历史 FT，
      // 临时绕过；后端恢复 state_id=5 过滤后可移除此行）
      ...(key === "other" ? { selectedTimeFilter: "today" as TimeFilter } : {}),
    }),

  setSelectedTimeFilter: (filter) =>
    set({
      selectedTimeFilter: filter,
      selectedTeamFilter: null,
      // 时间维度非 "all" 时清国家 chip，避免多维过滤后为空
      ...(filter !== "all" ? { selectedLeagueCountryId: null } : {}),
      ...(filter !== "calendar" ? { calendarDate: null } : {}),
    }),

  setSelectedTeamFilter: (team) => set({ selectedTeamFilter: team }),

  setCalendarDate: (date) => set({ calendarDate: date, selectedLeagueCountryId: null }),

  setSelectedLeagueCountryId: (countryId) => set({ selectedLeagueCountryId: countryId }),
}));

// Selectors
export const selectSelectedFixtureId = (s: MarketsLayoutStore) => s.selectedFixtureId;
export const selectSidebarCollapsed = (s: MarketsLayoutStore) => s.sidebarCollapsed;
export const selectSelectedCategory = (s: MarketsLayoutStore) => s.selectedCategory;
export const selectSelectedChip = (s: MarketsLayoutStore) => s.selectedChip;
export const selectSelectedTournament = (s: MarketsLayoutStore) => s.selectedTournament;
export const selectSelectedTimeFilter = (s: MarketsLayoutStore) => s.selectedTimeFilter;
export const selectSelectedTeamFilter = (s: MarketsLayoutStore) => s.selectedTeamFilter;
export const selectSelectedLeagueCountryId = (s: MarketsLayoutStore) => s.selectedLeagueCountryId;

export type LayoutState = "default" | "detail" | "betslip" | "betslip-only";

// Derived layout state — computed from two stores
// "betslip-only": has bet selections but no fixture selected (betslip panel only, no detail panel)
export function useLayoutState(): LayoutState {
  const fixtureId = useMarketsLayoutStore((s) => s.selectedFixtureId);
  const betSlipOpen = useBetSlipStore((s) => s.isOpen);

  if (fixtureId !== null && betSlipOpen) return "betslip";
  if (fixtureId !== null) return "detail";
  if (betSlipOpen) return "betslip-only";
  return "default";
}
