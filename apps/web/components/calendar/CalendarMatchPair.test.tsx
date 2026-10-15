// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import CalendarMatchPair from "./CalendarMatchPair";
import { useCalendarStore } from "@/stores/calendarStore";
import { useIsPhone } from "@/hooks/useIsPhone";
import type { SportmonksFixture } from "@/types/api";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
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

function makeFixture(id: number, home: string, away: string, isOpen = false): SportmonksFixture {
  return {
    id,
    league_id: 732,
    stage_id: 77478590,
    stage_name: "",
    name: `${home} vs ${away}`,
    starting_at: "2026-06-25 19:00:00",
    starting_at_timestamp: 1782838800,
    state_id: 1,
    has_odds: isOpen,
    enable_bet: isOpen,
    odds: [],
    participants: [
      {
        id: id * 10,
        name: home,
        short_code: home.toUpperCase().slice(0, 3),
        meta: { location: "home", winner: false },
      } as never,
      {
        id: id * 10 + 1,
        name: away,
        short_code: away.toUpperCase().slice(0, 3),
        meta: { location: "away", winner: false },
      } as never,
    ],
    league: { id: 732, name: "World Cup" },
    statistics: [],
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

describe("CalendarMatchPair", () => {
  it("renders both fixtures in compact form", () => {
    const fixtures: [SportmonksFixture, SportmonksFixture] = [
      makeFixture(100, "Argentina", "Peru"),
      makeFixture(101, "Brazil", "Chile"),
    ];
    render(<CalendarMatchPair fixtures={fixtures} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("ARG")).toBeTruthy();
    expect(screen.getByText("PER")).toBeTruthy();
    expect(screen.getByText("BRA")).toBeTruthy();
    expect(screen.getByText("CHI")).toBeTruthy();
  });

  it("clicking a sub-card opens that match (when open)", () => {
    const fixtures: [SportmonksFixture, SportmonksFixture] = [
      makeFixture(100, "Argentina", "Peru", true),
      makeFixture(101, "Brazil", "Chile", true),
    ];
    render(<CalendarMatchPair fixtures={fixtures} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]); // 第二张子卡
    expect(useCalendarStore.getState().openMatchId).toBe(101);
  });

  it("pre_open sub-card click is short-circuited", () => {
    const fixtures: [SportmonksFixture, SportmonksFixture] = [
      makeFixture(100, "Argentina", "Peru", false),
      makeFixture(101, "Brazil", "Chile", false),
    ];
    render(<CalendarMatchPair fixtures={fixtures} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(useCalendarStore.getState().openMatchId).toBeNull();
  });

  it("each sub-card has individual aria-label and aria-disabled", () => {
    const fixtures: [SportmonksFixture, SportmonksFixture] = [
      makeFixture(100, "Argentina", "Peru", true),
      makeFixture(101, "Brazil", "Chile", false),
    ];
    render(<CalendarMatchPair fixtures={fixtures} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].getAttribute("aria-disabled")).toBe("false");
    expect(buttons[1].getAttribute("aria-disabled")).toBe("true");
    expect(buttons[0].getAttribute("aria-label")).toContain("Argentina");
    expect(buttons[1].getAttribute("aria-label")).toContain("Brazil");
  });

  it("H5: clicking open sub-card → router.push to fixture detail, store not updated", () => {
    vi.mocked(useIsPhone).mockReturnValue(true);
    const fixtures: [SportmonksFixture, SportmonksFixture] = [
      makeFixture(100, "Argentina", "Peru", true),
      makeFixture(101, "Brazil", "Chile", true),
    ];
    render(<CalendarMatchPair fixtures={fixtures} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(mockPush).toHaveBeenCalledWith("/en/markets/fixture/100");
    expect(useCalendarStore.getState().openMatchId).toBeNull();
  });
});
