// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import CalendarHoverPopover from "./CalendarHoverPopover";
import { useCalendarStore } from "@/stores/calendarStore";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";

const toggleSelectionMock = vi.fn();

vi.mock("@/stores/marketsLayoutStore", () => ({
  useMarketsLayoutStore: {
    getState: () => ({ selectFixture: vi.fn(), closeDetail: vi.fn() }),
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/stores/betSlipStore", () => ({
  useBetSlipStore: (selector: (s: unknown) => unknown) =>
    selector({ toggleSelection: toggleSelectionMock }),
  selectIsSelected: () => () => false,
}));

vi.mock("@/components/ui/SportIcon", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="sport-icon">{alt}</span>,
}));

function makeOdd(label: string, value: string): SportmonksOddsEntry {
  return {
    id: Math.floor(Math.random() * 100000),
    fixture_id: 1,
    market_id: 1,
    bookmaker_id: 1,
    label,
    value,
    name: null,
    market_description: "Fulltime Result",
    probability: "33.33%",
    total: null,
    handicap: null,
    sort_order: 0,
  } as SportmonksOddsEntry;
}

function makeFixture(isOpen = false): SportmonksFixture {
  return {
    id: 19609127,
    league_id: 732,
    stage_id: 77478590,
    stage_name: "",
    name: "Mexico vs South Africa",
    starting_at: "2026-06-11 19:00:00",
    starting_at_timestamp: 1781204400,
    state_id: 1,
    has_odds: isOpen,
    enable_bet: isOpen,
    odds: isOpen ? [makeOdd("Home", "1.85"), makeOdd("Draw", "3.40"), makeOdd("Away", "4.20")] : [],
    participants: [
      {
        id: 1,
        name: "Mexico",
        short_code: "MEX",
        meta: { location: "home", winner: false },
      } as never,
      {
        id: 2,
        name: "South Africa",
        short_code: "ZAF",
        meta: { location: "away", winner: false },
      } as never,
    ],
    league: { id: 732, name: "World Cup" },
    statistics: [],
  } as SportmonksFixture;
}

beforeEach(() => {
  toggleSelectionMock.mockClear();
  useCalendarStore.setState({
    selectedGroups: null,
    dateRange: null,
    activeStage: "group",
    pinnedStage: null,
    tzPref: "UTC",
    openMatchId: null,
  });
});

describe("CalendarHoverPopover", () => {
  it("renders team names + meta + 3 odds cells (open status)", () => {
    render(
      <CalendarHoverPopover
        fixture={makeFixture(true)}
        position={{ top: 100, left: 200, placement: "above" }}
      />
    );
    expect(screen.getAllByText("Mexico").length).toBeGreaterThanOrEqual(1);
    // South Africa 长度 12 在 OddsCell 中被 slice(0,8) 截断为 "South Af"
    expect(screen.getByText("South Africa")).toBeTruthy();
    expect(screen.getByText("1.85")).toBeTruthy();
    expect(screen.getByText("3.40")).toBeTruthy();
    expect(screen.getByText("4.20")).toBeTruthy();
  });

  it("renders pre-open lock + short codes when status=pre_open", () => {
    render(
      <CalendarHoverPopover
        fixture={makeFixture(false)}
        position={{ top: 100, left: 200, placement: "above" }}
      />
    );
    expect(screen.getByText("hover.preOpen")).toBeTruthy();
    expect(screen.getByText("MEX")).toBeTruthy();
    expect(screen.getByText("ZAF")).toBeTruthy();
  });

  it("clicking odd cell adds to BetSlip when open", () => {
    render(
      <CalendarHoverPopover
        fixture={makeFixture(true)}
        position={{ top: 100, left: 200, placement: "above" }}
      />
    );
    const homeBtn = screen.getByText("1.85").closest("button");
    fireEvent.click(homeBtn!);
    expect(toggleSelectionMock).toHaveBeenCalled();
    const arg = toggleSelectionMock.mock.calls[0][0];
    expect(arg.fixtureId).toBe(19609127);
    expect(arg.marketType).toBe("1x2");
  });

  it("pre_open state renders no clickable buttons (locked, no bet interaction)", () => {
    render(
      <CalendarHoverPopover
        fixture={makeFixture(false)}
        position={{ top: 100, left: 200, placement: "above" }}
      />
    );
    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(0);
    expect(toggleSelectionMock).not.toHaveBeenCalled();
  });

  it("forwards onMouseEnter / onMouseLeave callbacks", () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    render(
      <CalendarHoverPopover
        fixture={makeFixture(true)}
        position={{ top: 100, left: 200, placement: "above" }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />
    );
    const popover = screen.getByRole("dialog");
    fireEvent.mouseEnter(popover);
    fireEvent.mouseLeave(popover);
    expect(onEnter).toHaveBeenCalled();
    expect(onLeave).toHaveBeenCalled();
  });

  it("dialog has aria-label and optional describedby", () => {
    render(
      <CalendarHoverPopover
        fixture={makeFixture(true)}
        position={{ top: 100, left: 200, placement: "above" }}
        describedById="card-19609127"
      />
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toContain("Mexico");
    expect(dialog.getAttribute("aria-describedby")).toBe("card-19609127");
  });
});
