// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock useMatchDetailLineups
const mockUseMatchDetailLineups = vi.fn();
vi.mock("@/hooks/useMatchDetailLineups", () => ({
  useMatchDetailLineups: (...args: unknown[]) => mockUseMatchDetailLineups(...args),
}));

// Mock useQueryClient
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// Mock LineupCardList and LineupCardFormation to keep tests focused
vi.mock("./lineups/LineupCardList", () => ({
  LineupCardList: ({ lineup, team }: { lineup: { team_name: string }; team: string }) => (
    <div data-testid={`lineup-list-${team}`}>{lineup.team_name}</div>
  ),
}));

vi.mock("./lineups/LineupCardFormation", () => ({
  LineupCardFormation: ({
    home,
    away,
  }: {
    home: { formation: string };
    away: { formation: string };
  }) => (
    <div data-testid="lineup-formation">
      <span>FORMATION</span>
      <span>{home.formation}</span>
      <span>{away.formation}</span>
    </div>
  ),
}));

import { LineupsTab } from "./LineupsTab";
import type { MatchLineupsDomain } from "@/types/match-detail-domain";

const mockHomeLineup = {
  team_id: 1,
  team_name: "Manchester City",
  formation: "4-2-3-1",
  players: [],
};

const mockAwayLineup = {
  team_id: 2,
  team_name: "Crystal Palace",
  formation: "4-4-2",
  players: [],
};

const mockDataWithLineups: MatchLineupsDomain = {
  lineups: { home: mockHomeLineup, away: mockAwayLineup },
  availableAt: new Date("2026-06-11T17:00:00Z"),
};

const mockDataNoLineups: MatchLineupsDomain = {
  lineups: null,
  availableAt: new Date("2026-06-11T17:00:00Z"),
};

describe("LineupsTab — loading state", () => {
  it("renders skeleton when isLoading=true", () => {
    mockUseMatchDetailLineups.mockReturnValue({ data: null, isLoading: true, isError: false });
    render(<LineupsTab fixtureId={123} enabled />);
    expect(screen.getByTestId("lineups-skeleton")).toBeTruthy();
  });
});

describe("LineupsTab — error state", () => {
  it("renders error state when isError=true", () => {
    mockUseMatchDetailLineups.mockReturnValue({ data: null, isLoading: false, isError: true });
    render(<LineupsTab fixtureId={123} enabled />);
    expect(screen.getByTestId("lineups-error")).toBeTruthy();
    expect(screen.getByTestId("lineups-retry-btn")).toBeTruthy();
  });
});

describe("LineupsTab — lineup not available yet (lineups=null)", () => {
  it("renders not-available state with availableAt time", () => {
    mockUseMatchDetailLineups.mockReturnValue({
      data: mockDataNoLineups,
      isLoading: false,
      isError: false,
    });
    render(<LineupsTab fixtureId={123} enabled />);
    expect(screen.getByTestId("lineups-not-available")).toBeTruthy();
    expect(screen.getByText(/Lineup available 1h before kickoff/i)).toBeTruthy();
  });

  it("paginator buttons are disabled when lineups=null", () => {
    mockUseMatchDetailLineups.mockReturnValue({
      data: mockDataNoLineups,
      isLoading: false,
      isError: false,
    });
    render(<LineupsTab fixtureId={123} enabled />);
    const buttons = screen.getAllByRole("button");
    // Both paginator buttons (prev and next) should be disabled
    buttons.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });
});

describe("LineupsTab — data state with lineups", () => {
  beforeEach(() => {
    mockUseMatchDetailLineups.mockReturnValue({
      data: mockDataWithLineups,
      isLoading: false,
      isError: false,
    });
  });

  it("renders home lineup list on slide 0 (default)", () => {
    render(<LineupsTab fixtureId={123} enabled />);
    expect(screen.getByTestId("lineup-list-home")).toBeTruthy();
    expect(screen.getByText("Manchester City")).toBeTruthy();
    expect(screen.queryByTestId("lineup-list-away")).toBeNull();
    expect(screen.queryByTestId("lineup-formation")).toBeNull();
  });

  it("clicking next advances to slide 1 showing formation", () => {
    render(<LineupsTab fixtureId={123} enabled />);
    const buttons = screen.getAllByRole("button");
    const enabledBtns = buttons.filter((b) => !(b as HTMLButtonElement).disabled);
    fireEvent.click(enabledBtns[enabledBtns.length - 1]);

    expect(screen.getByTestId("lineup-formation")).toBeTruthy();
    expect(screen.getByText("FORMATION")).toBeTruthy();
    expect(screen.getByText("4-2-3-1")).toBeTruthy();
  });

  it("clicking next twice advances to slide 2 showing away lineup", () => {
    render(<LineupsTab fixtureId={123} enabled />);
    for (let i = 0; i < 2; i++) {
      const buttons = screen.getAllByRole("button");
      const enabledBtns = buttons.filter((b) => !(b as HTMLButtonElement).disabled);
      fireEvent.click(enabledBtns[enabledBtns.length - 1]);
    }
    expect(screen.getByTestId("lineup-list-away")).toBeTruthy();
    expect(screen.getByText("Crystal Palace")).toBeTruthy();
  });

  it("prev button is disabled on slide 0", () => {
    render(<LineupsTab fixtureId={123} enabled />);
    const buttons = screen.getAllByRole("button");
    const prevBtn = buttons[0];
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("next button is disabled on last slide (slide 2)", () => {
    render(<LineupsTab fixtureId={123} enabled />);
    for (let i = 0; i < 2; i++) {
      const buttons = screen.getAllByRole("button");
      const enabledBtns = buttons.filter((b) => !(b as HTMLButtonElement).disabled);
      fireEvent.click(enabledBtns[enabledBtns.length - 1]);
    }
    const buttons = screen.getAllByRole("button");
    const nextBtn = buttons[buttons.length - 1];
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("displays slide counter as 1/3 initially", () => {
    render(<LineupsTab fixtureId={123} enabled />);
    expect(screen.getByText("1/3")).toBeTruthy();
  });

  it("displays slide counter as 2/3 on slide 1", () => {
    render(<LineupsTab fixtureId={123} enabled />);
    const buttons = screen.getAllByRole("button");
    const enabledBtns = buttons.filter((b) => !(b as HTMLButtonElement).disabled);
    fireEvent.click(enabledBtns[enabledBtns.length - 1]);
    expect(screen.getByText("2/3")).toBeTruthy();
  });
});

describe("LineupsTab — disabled state", () => {
  it("calls hook with enabled=false when not active", () => {
    mockUseMatchDetailLineups.mockReturnValue({ data: null, isLoading: false, isError: false });
    render(<LineupsTab fixtureId={123} enabled={false} />);
    expect(mockUseMatchDetailLineups).toHaveBeenCalledWith(123, false);
  });
});
