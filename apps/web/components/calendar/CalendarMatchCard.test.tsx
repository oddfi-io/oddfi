// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import CalendarMatchCard from "./CalendarMatchCard";
import { useCalendarStore } from "@/stores/calendarStore";
import { useIsPhone } from "@/hooks/useIsPhone";
import type { SportmonksFixture } from "@/types/api";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    const map: Record<string, string> = {
      "stages.group": "Group Stage",
      "stages.r32": "Round of 32",
      "stages.r16": "Round of 16",
      "stages.qf": "Quarter-finals",
      "stages.sf": "Semi-finals",
      "stages.third": "3rd Place",
      "stages.final": "Final",
    };
    if (key === "hover.groupLabel" && params) return `Group ${params.name}`;
    return map[key] ?? key;
  },
}));
vi.mock("@/hooks/useIsPhone", () => ({
  useIsPhone: vi.fn(() => false),
}));
vi.mock("@/stores/marketsLayoutStore", () => ({
  useMarketsLayoutStore: {
    getState: () => ({ selectFixture: vi.fn(), closeDetail: vi.fn() }),
  },
}));
vi.mock("@/components/ui/SportIcon", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="sport-icon">{alt}</span>,
}));

function makeFixture(overrides: Partial<SportmonksFixture> = {}): SportmonksFixture {
  return {
    id: 19609127,
    league_id: 732,
    stage_id: 77478590, // group
    stage_name: "",
    name: "Mexico vs South Africa",
    starting_at: "2026-06-11 19:00:00",
    starting_at_timestamp: 1781204400, // 19:00 UTC
    state_id: 1,
    has_odds: false,
    enable_bet: false,
    odds: [],
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
    ...overrides,
  } as SportmonksFixture;
}

beforeEach(() => {
  mockPush.mockReset();
  vi.mocked(useIsPhone).mockReturnValue(false);
  useCalendarStore.setState({
    selectedGroups: null,
    dateRange: null,
    activeStage: "group",
    pinnedStage: null,
    tzPref: "UTC",
    openMatchId: null,
  });
});

describe("CalendarMatchCard", () => {
  it("renders home/away short codes and stage label", () => {
    render(<CalendarMatchCard fixture={makeFixture()} />);
    expect(screen.getByText("MEX")).toBeTruthy();
    expect(screen.getByText("ZAF")).toBeTruthy();
    expect(screen.getByText(/Group Stage/)).toBeTruthy();
  });

  it("derives short_code from name when missing", () => {
    const fixture = makeFixture({
      participants: [
        { id: 1, name: "Argentina", meta: { location: "home", winner: false } } as never,
        { id: 2, name: "Peru", meta: { location: "away", winner: false } } as never,
      ],
    });
    render(<CalendarMatchCard fixture={fixture} />);
    expect(screen.getByText("ARG")).toBeTruthy();
    expect(screen.getByText("PER")).toBeTruthy();
  });

  it("shows lock icon and aria-disabled for pre_open match", () => {
    render(<CalendarMatchCard fixture={makeFixture({ has_odds: false, enable_bet: false })} />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("hides lock icon for open match", () => {
    render(<CalendarMatchCard fixture={makeFixture({ has_odds: true, enable_bet: true })} />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-disabled")).toBe("false");
  });

  it("click opens match when status=open", () => {
    render(<CalendarMatchCard fixture={makeFixture({ has_odds: true, enable_bet: true })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(useCalendarStore.getState().openMatchId).toBe(19609127);
  });

  it("click is short-circuited when status=pre_open", () => {
    render(<CalendarMatchCard fixture={makeFixture()} />);
    fireEvent.click(screen.getByRole("button"));
    expect(useCalendarStore.getState().openMatchId).toBeNull();
  });

  it("pre_open card still fires hover handlers (popover shows 待开盘 state)", () => {
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();
    render(
      <CalendarMatchCard
        fixture={makeFixture({ has_odds: false, enable_bet: false })}
        hoverProps={{ onMouseEnter, onMouseLeave }}
      />
    );
    const btn = screen.getByRole("button");
    fireEvent.mouseEnter(btn);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(btn);
    expect(onMouseLeave).toHaveBeenCalledTimes(1);
  });

  it("aria-label describes match for screen readers", () => {
    render(<CalendarMatchCard fixture={makeFixture()} />);
    const btn = screen.getByRole("button");
    const label = btn.getAttribute("aria-label") || "";
    expect(label).toContain("Mexico");
    expect(label).toContain("South Africa");
    expect(label).toContain("Group Stage");
  });

  it("highlights with tertiary bg when openMatchId equals fixture.id", () => {
    useCalendarStore.setState({ openMatchId: 19609127 });
    render(<CalendarMatchCard fixture={makeFixture()} />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-tertiary");
  });

  it("H5: click open match → router.push to fixture detail, store not updated", () => {
    vi.mocked(useIsPhone).mockReturnValue(true);
    render(<CalendarMatchCard fixture={makeFixture({ has_odds: true, enable_bet: true })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockPush).toHaveBeenCalledWith("/en/markets/fixture/19609127");
    expect(useCalendarStore.getState().openMatchId).toBeNull();
  });
});
