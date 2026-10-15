// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import CalendarStageTabs from "./CalendarStageTabs";
import { useCalendarStore } from "@/stores/calendarStore";
import type { CalendarStage } from "@/types/calendar";

vi.mock("@/stores/marketsLayoutStore", () => ({
  useMarketsLayoutStore: {
    getState: () => ({ selectFixture: vi.fn(), closeDetail: vi.fn() }),
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "stages.group": "Group Stage",
      "stages.r32": "Round of 32",
      "stages.r16": "Round of 16",
      "stages.qf": "Quarter-finals",
      "stages.sf": "Semi-finals",
      "stages.third": "3rd Place",
      "stages.final": "Final",
    };
    return map[key] ?? key;
  },
}));

const STAGES: CalendarStage[] = [
  {
    stage_id: "group",
    label: "Group Stage",
    date_start: "2026-06-11",
    date_end: "2026-06-27",
    days: 17,
    match_count: 72,
  },
  {
    stage_id: "r32",
    label: "Round of 32",
    date_start: "2026-06-29",
    date_end: "2026-07-03",
    days: 5,
    match_count: 16,
  },
  {
    stage_id: "r16",
    label: "Round of 16",
    date_start: "2026-07-04",
    date_end: "2026-07-07",
    days: 4,
    match_count: 8,
  },
  {
    stage_id: "qf",
    label: "Quarter-finals",
    date_start: "2026-07-09",
    date_end: "2026-07-11",
    days: 3,
    match_count: 4,
  },
  {
    stage_id: "sf",
    label: "Semi-finals",
    date_start: "2026-07-14",
    date_end: "2026-07-15",
    days: 2,
    match_count: 2,
  },
  {
    stage_id: "third",
    label: "3rd Place",
    date_start: "2026-07-18",
    date_end: "2026-07-18",
    days: 1,
    match_count: 1,
  },
  {
    stage_id: "final",
    label: "Final",
    date_start: "2026-07-19",
    date_end: "2026-07-19",
    days: 1,
    match_count: 1,
  },
];

beforeEach(() => {
  useCalendarStore.setState({
    selectedGroups: null,
    dateRange: null,
    activeStage: "group",
    pinnedStage: null,
    tzPref: "UTC",
    openMatchId: null,
  });
});

describe("CalendarStageTabs", () => {
  it("renders 7 tabs in fixed order regardless of input order", () => {
    const shuffled = [...STAGES].reverse();
    render(<CalendarStageTabs stages={shuffled} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(7);
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Group Stage",
      "Round of 32",
      "Round of 16",
      "Quarter-finals",
      "Semi-finals",
      "3rd Place",
      "Final",
    ]);
  });

  it("marks active tab with aria-selected=true", () => {
    useCalendarStore.setState({ activeStage: "qf" });
    render(<CalendarStageTabs stages={STAGES} />);
    const activeTab = screen.getByRole("tab", { selected: true });
    expect(activeTab.textContent).toBe("Quarter-finals");
  });

  it("clicking tab pins it and triggers onSelect callback", () => {
    const onSelect = vi.fn();
    render(<CalendarStageTabs stages={STAGES} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("tab", { name: "Round of 16" }));
    expect(useCalendarStore.getState().pinnedStage).toBe("r16");
    expect(useCalendarStore.getState().activeStage).toBe("r16");
    expect(onSelect).toHaveBeenCalledWith("r16");
  });

  it("renders only stages present in input (defensive: missing stage skipped)", () => {
    const partial = STAGES.slice(0, 3); // only group / r32 / r16
    render(<CalendarStageTabs stages={partial} />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.queryByText("Final")).toBeNull();
  });

  it("renders tablist role with aria-label", () => {
    render(<CalendarStageTabs stages={STAGES} />);
    const tablist = screen.getByRole("tablist");
    expect(tablist.getAttribute("aria-label")).toBe("Tournament stages");
  });

  it("uses roving tabindex (active=0, others=-1)", () => {
    useCalendarStore.setState({ activeStage: "qf" });
    render(<CalendarStageTabs stages={STAGES} />);
    const tabs = screen.getAllByRole("tab");
    const activeIdx = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    expect(tabs[activeIdx].getAttribute("tabindex")).toBe("0");
    const inactive = tabs.find((t) => t.getAttribute("aria-selected") !== "true")!;
    expect(inactive.getAttribute("tabindex")).toBe("-1");
  });

  it("ArrowRight cycles to next tab and pins it", () => {
    render(<CalendarStageTabs stages={STAGES} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Group Stage" }), { key: "ArrowRight" });
    expect(useCalendarStore.getState().pinnedStage).toBe("r32");
  });

  it("ArrowLeft from first wraps to last", () => {
    render(<CalendarStageTabs stages={STAGES} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Group Stage" }), { key: "ArrowLeft" });
    expect(useCalendarStore.getState().pinnedStage).toBe("final");
  });

  it("Home jumps to first, End jumps to last", () => {
    useCalendarStore.setState({ activeStage: "qf" });
    render(<CalendarStageTabs stages={STAGES} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Quarter-finals" }), { key: "Home" });
    expect(useCalendarStore.getState().pinnedStage).toBe("group");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Group Stage" }), { key: "End" });
    expect(useCalendarStore.getState().pinnedStage).toBe("final");
  });
});
