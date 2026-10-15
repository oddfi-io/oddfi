import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCalendarStore } from "./calendarStore";

// ─── Mock marketsLayoutStore（避免实际派发到现有 store） ───────────────────
const selectFixtureMock = vi.fn();
const closeDetailMock = vi.fn();

vi.mock("@/stores/marketsLayoutStore", () => ({
  useMarketsLayoutStore: {
    getState: () => ({
      selectFixture: selectFixtureMock,
      closeDetail: closeDetailMock,
    }),
  },
}));

beforeEach(() => {
  // 重置 store 到默认值
  useCalendarStore.setState({
    selectedGroups: null,
    dateRange: null,
    activeStage: "group",
    pinnedStage: null,
    tzPref: "UTC",
    openMatchId: null,
  });
  selectFixtureMock.mockClear();
  closeDetailMock.mockClear();
});

describe("calendarStore — initial state", () => {
  it("matches default values from DD §3.6", () => {
    const s = useCalendarStore.getState();
    expect(s.selectedGroups).toBeNull();
    expect(s.dateRange).toBeNull();
    expect(s.activeStage).toBe("group");
    expect(s.pinnedStage).toBeNull();
    expect(s.tzPref).toBe("UTC");
    expect(s.openMatchId).toBeNull();
  });
});

describe("calendarStore — Stage tabs / pin", () => {
  it("setActiveStage updates when not pinned", () => {
    useCalendarStore.getState().setActiveStage("r32");
    expect(useCalendarStore.getState().activeStage).toBe("r32");
  });

  it("setActiveStage is ignored while pinned", () => {
    useCalendarStore.getState().setPinnedStage("qf");
    useCalendarStore.getState().setActiveStage("r32"); // ignored
    expect(useCalendarStore.getState().activeStage).toBe("qf");
  });

  it("setPinnedStage syncs activeStage", () => {
    useCalendarStore.getState().setPinnedStage("sf");
    expect(useCalendarStore.getState().activeStage).toBe("sf");
    expect(useCalendarStore.getState().pinnedStage).toBe("sf");
  });

  it("releasePin clears pinnedStage but keeps activeStage", () => {
    useCalendarStore.getState().setPinnedStage("final");
    useCalendarStore.getState().releasePin();
    expect(useCalendarStore.getState().pinnedStage).toBeNull();
    expect(useCalendarStore.getState().activeStage).toBe("final");
  });
});

describe("calendarStore — Group filter", () => {
  it("toggleGroup adds when not selected", () => {
    useCalendarStore.getState().setSelectedGroups([]);
    useCalendarStore.getState().toggleGroup("Group A");
    expect(useCalendarStore.getState().selectedGroups).toEqual(["Group A"]);
  });

  it("toggleGroup removes when already selected", () => {
    useCalendarStore.getState().setSelectedGroups(["Group A", "Group B"]);
    useCalendarStore.getState().toggleGroup("Group A");
    expect(useCalendarStore.getState().selectedGroups).toEqual(["Group B"]);
  });

  it("toggleGroup resets to null when last selected removed", () => {
    useCalendarStore.getState().setSelectedGroups(["Group A"]);
    useCalendarStore.getState().toggleGroup("Group A");
    expect(useCalendarStore.getState().selectedGroups).toBeNull();
  });

  it("clearGroupFilter sets to null", () => {
    useCalendarStore.getState().setSelectedGroups(["Group A"]);
    useCalendarStore.getState().clearGroupFilter();
    expect(useCalendarStore.getState().selectedGroups).toBeNull();
  });
});

describe("calendarStore — Date range / tz", () => {
  it("setDateRange accepts and clears", () => {
    useCalendarStore.getState().setDateRange({ start: "2026-06-11", end: "2026-06-15" });
    expect(useCalendarStore.getState().dateRange).toEqual({
      start: "2026-06-11",
      end: "2026-06-15",
    });
    useCalendarStore.getState().setDateRange(null);
    expect(useCalendarStore.getState().dateRange).toBeNull();
  });

  it("setTzPref toggles UTC ↔ local", () => {
    useCalendarStore.getState().setTzPref("local");
    expect(useCalendarStore.getState().tzPref).toBe("local");
    useCalendarStore.getState().setTzPref("UTC");
    expect(useCalendarStore.getState().tzPref).toBe("UTC");
  });
});

describe("calendarStore — openMatch / closeMatch sync to marketsLayoutStore", () => {
  it("openMatch sets openMatchId AND calls marketsLayoutStore.selectFixture", () => {
    useCalendarStore.getState().openMatch(19609127);
    expect(useCalendarStore.getState().openMatchId).toBe(19609127);
    expect(selectFixtureMock).toHaveBeenCalledWith(19609127);
  });

  it("closeMatch clears openMatchId AND calls marketsLayoutStore.closeDetail", () => {
    useCalendarStore.getState().openMatch(19609127);
    useCalendarStore.getState().closeMatch();
    expect(useCalendarStore.getState().openMatchId).toBeNull();
    expect(closeDetailMock).toHaveBeenCalledTimes(1);
  });
});
