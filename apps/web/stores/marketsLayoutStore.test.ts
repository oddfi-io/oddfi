/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useMarketsLayoutStore,
  useLayoutState,
  selectSelectedFixtureId,
  selectSidebarCollapsed,
  selectSelectedCategory,
} from "./marketsLayoutStore";

// Shared mutable mock state for betSlipStore
const mockBetSlipState = { isOpen: false };

// Mock betSlipStore for useLayoutState tests
vi.mock("@/stores/betSlipStore", () => ({
  useBetSlipStore: (selector: (s: typeof mockBetSlipState) => unknown) =>
    selector(mockBetSlipState),
}));

function resetStore() {
  useMarketsLayoutStore.setState({
    selectedFixtureId: null,
    sidebarCollapsed: false,
    sidebarUserPreference: false,
    selectedCategory: "all",
    selectedTournament: "worldcup",
  });
}

describe("marketsLayoutStore", () => {
  beforeEach(() => {
    resetStore();
  });

  // ----- Initial State -----

  it("has correct initial state", () => {
    const state = useMarketsLayoutStore.getState();
    expect(state.selectedFixtureId).toBeNull();
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.sidebarUserPreference).toBe(false);
    expect(state.selectedCategory).toBe("all");
    expect(state.selectedTournament).toBe("worldcup");
  });

  // ----- selectFixture -----

  it("selectFixture sets selectedFixtureId", () => {
    useMarketsLayoutStore.getState().selectFixture(123);
    expect(useMarketsLayoutStore.getState().selectedFixtureId).toBe(123);
  });

  it("selectFixture can be called multiple times with different IDs", () => {
    const { selectFixture } = useMarketsLayoutStore.getState();
    selectFixture(1);
    expect(useMarketsLayoutStore.getState().selectedFixtureId).toBe(1);
    useMarketsLayoutStore.getState().selectFixture(999);
    expect(useMarketsLayoutStore.getState().selectedFixtureId).toBe(999);
  });

  // ----- closeDetail -----

  it("closeDetail resets selectedFixtureId to null", () => {
    const store = useMarketsLayoutStore.getState();
    store.selectFixture(42);
    useMarketsLayoutStore.getState().closeDetail();
    expect(useMarketsLayoutStore.getState().selectedFixtureId).toBeNull();
  });

  it("closeDetail restores sidebarCollapsed to sidebarUserPreference", () => {
    // User manually collapsed the sidebar
    useMarketsLayoutStore.getState().toggleSidebar();
    expect(useMarketsLayoutStore.getState().sidebarCollapsed).toBe(true);
    expect(useMarketsLayoutStore.getState().sidebarUserPreference).toBe(true);

    // Programmatic override opens sidebar (does not affect user preference)
    useMarketsLayoutStore.getState().setSidebarCollapsed(false);
    expect(useMarketsLayoutStore.getState().sidebarCollapsed).toBe(false);
    expect(useMarketsLayoutStore.getState().sidebarUserPreference).toBe(true);

    // closeDetail should restore sidebar to user preference (true)
    useMarketsLayoutStore.getState().selectFixture(10);
    useMarketsLayoutStore.getState().closeDetail();
    expect(useMarketsLayoutStore.getState().sidebarCollapsed).toBe(true);
  });

  it("closeDetail restores sidebar to false when user never collapsed", () => {
    // Default userPreference is false
    useMarketsLayoutStore.getState().setSidebarCollapsed(true);
    useMarketsLayoutStore.getState().selectFixture(5);
    useMarketsLayoutStore.getState().closeDetail();
    expect(useMarketsLayoutStore.getState().sidebarCollapsed).toBe(false);
  });

  // ----- toggleSidebar -----

  it("toggleSidebar flips sidebarCollapsed and updates userPreference", () => {
    useMarketsLayoutStore.getState().toggleSidebar();
    const s1 = useMarketsLayoutStore.getState();
    expect(s1.sidebarCollapsed).toBe(true);
    expect(s1.sidebarUserPreference).toBe(true);

    useMarketsLayoutStore.getState().toggleSidebar();
    const s2 = useMarketsLayoutStore.getState();
    expect(s2.sidebarCollapsed).toBe(false);
    expect(s2.sidebarUserPreference).toBe(false);
  });

  // ----- setSidebarCollapsed -----

  it("setSidebarCollapsed sets collapsed without affecting userPreference", () => {
    // userPreference starts at false
    useMarketsLayoutStore.getState().setSidebarCollapsed(true);
    const state = useMarketsLayoutStore.getState();
    expect(state.sidebarCollapsed).toBe(true);
    expect(state.sidebarUserPreference).toBe(false);
  });

  it("setSidebarCollapsed(false) does not reset userPreference", () => {
    // User toggles to collapse
    useMarketsLayoutStore.getState().toggleSidebar();
    expect(useMarketsLayoutStore.getState().sidebarUserPreference).toBe(true);

    // Programmatic uncollapse
    useMarketsLayoutStore.getState().setSidebarCollapsed(false);
    expect(useMarketsLayoutStore.getState().sidebarCollapsed).toBe(false);
    // userPreference remains true
    expect(useMarketsLayoutStore.getState().sidebarUserPreference).toBe(true);
  });

  // ----- setSelectedCategory -----

  it("setSelectedCategory sets category", () => {
    useMarketsLayoutStore.getState().setSelectedCategory("england");
    expect(useMarketsLayoutStore.getState().selectedCategory).toBe("england");
  });

  it("setSelectedCategory can reset to all", () => {
    useMarketsLayoutStore.getState().setSelectedCategory("worldcup");
    useMarketsLayoutStore.getState().setSelectedCategory("all");
    expect(useMarketsLayoutStore.getState().selectedCategory).toBe("all");
  });

  // ----- Selectors -----

  describe("selectors", () => {
    it("selectSelectedFixtureId returns selectedFixtureId", () => {
      useMarketsLayoutStore.getState().selectFixture(77);
      const state = useMarketsLayoutStore.getState();
      expect(selectSelectedFixtureId(state)).toBe(77);
    });

    it("selectSidebarCollapsed returns sidebarCollapsed", () => {
      useMarketsLayoutStore.getState().toggleSidebar();
      const state = useMarketsLayoutStore.getState();
      expect(selectSidebarCollapsed(state)).toBe(true);
    });

    it("selectSelectedCategory returns selectedCategory", () => {
      useMarketsLayoutStore.getState().setSelectedCategory("france");
      const state = useMarketsLayoutStore.getState();
      expect(selectSelectedCategory(state)).toBe("france");
    });
  });
});

// useLayoutState tests — separate describe because they depend on mocked betSlipStore
describe("useLayoutState", () => {
  beforeEach(() => {
    resetStore();
    mockBetSlipState.isOpen = false;
  });

  it('returns "default" when no fixture is selected', () => {
    const { result } = renderHook(() => useLayoutState());
    expect(result.current).toBe("default");
  });

  it('returns "detail" when fixture is selected and betslip closed', () => {
    useMarketsLayoutStore.getState().selectFixture(42);
    const { result } = renderHook(() => useLayoutState());
    expect(result.current).toBe("detail");
  });

  it('returns "betslip" when fixture is selected and betslip open', () => {
    useMarketsLayoutStore.getState().selectFixture(42);
    mockBetSlipState.isOpen = true;
    const { result } = renderHook(() => useLayoutState());
    expect(result.current).toBe("betslip");
  });

  it('returns "betslip-only" when no fixture selected but betslip open', () => {
    mockBetSlipState.isOpen = true;
    const { result } = renderHook(() => useLayoutState());
    expect(result.current).toBe("betslip-only");
  });

  it('returns "detail" when betslip is dismissed (closed without clearing)', () => {
    useMarketsLayoutStore.getState().selectFixture(42);
    mockBetSlipState.isOpen = false; // dismissed
    const { result } = renderHook(() => useLayoutState());
    expect(result.current).toBe("detail");
  });
});
