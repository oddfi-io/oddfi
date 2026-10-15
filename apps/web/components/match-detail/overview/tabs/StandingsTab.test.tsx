// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock useMatchDetailStandings
const mockUseMatchDetailStandings = vi.fn();
vi.mock("@/hooks/useMatchDetailStandings", () => ({
  useMatchDetailStandings: (...args: unknown[]) => mockUseMatchDetailStandings(...args),
}));

// Mock useQueryClient
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { StandingsTab } from "./StandingsTab";
import type { MatchStandingsDomain } from "@/types/match-detail-domain";

const mockRows = [
  {
    participantId: 1,
    position: 1,
    result: "up" as const,
    points: 75,
    played: 35,
    won: 23,
    draw: 6,
    lost: 6,
    goalDifference: 45,
    teamName: "Liverpool",
    teamLogo: "",
    shortCode: "LIV",
  },
  {
    participantId: 2,
    position: 2,
    result: null,
    points: 70,
    played: 35,
    won: 21,
    draw: 7,
    lost: 7,
    goalDifference: 38,
    teamName: "Manchester City",
    teamLogo: "",
    shortCode: "MCI",
  },
];

const mockDomain: MatchStandingsDomain = {
  leagueName: "Premier League",
  seasonName: "25/26",
  byScope: {
    overall: mockRows,
    home: mockRows,
    away: mockRows,
  },
};

describe("StandingsTab — loading state", () => {
  it("renders skeleton when isLoading=true", () => {
    mockUseMatchDetailStandings.mockReturnValue({
      rows: null,
      leagueName: null,
      seasonName: null,
      isLoading: true,
      isError: false,
    });
    render(<StandingsTab fixtureId={123} enabled />);
    expect(screen.getByTestId("standings-skeleton")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("StandingsTab — error state", () => {
  it("renders error state when isError=true", () => {
    mockUseMatchDetailStandings.mockReturnValue({
      rows: null,
      leagueName: null,
      seasonName: null,
      isLoading: false,
      isError: true,
    });
    render(<StandingsTab fixtureId={123} enabled />);
    expect(screen.getByTestId("standings-error")).toBeTruthy();
    expect(screen.getByTestId("standings-retry-btn")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("StandingsTab — data state", () => {
  beforeEach(() => {
    mockUseMatchDetailStandings.mockReturnValue({
      rows: mockDomain.byScope.overall,
      leagueName: mockDomain.leagueName,
      seasonName: mockDomain.seasonName,
      isLoading: false,
      isError: false,
    });
  });

  it("renders Overall scope by default with team rows", () => {
    render(<StandingsTab fixtureId={123} enabled />);
    expect(screen.getByRole("tab", { name: "Overall" })).toBeTruthy();
    expect(screen.getByText("Liverpool")).toBeTruthy();
    expect(screen.getByText("Manchester City")).toBeTruthy();
  });

  it("renders leagueName + seasonName from domain data", () => {
    render(<StandingsTab fixtureId={123} enabled />);
    expect(screen.getByText("Premier League 25/26")).toBeTruthy();
  });

  it("renders Standings section header", () => {
    render(<StandingsTab fixtureId={123} enabled />);
    expect(screen.getByText("Standings")).toBeTruthy();
  });

  it("clicking Home sub-tab calls hook with scope='home'", () => {
    render(<StandingsTab fixtureId={123} enabled />);
    const homeBtn = screen.getByRole("tab", { name: "Home" });
    fireEvent.click(homeBtn);
    // Hook should have been called with scope='home'
    expect(mockUseMatchDetailStandings).toHaveBeenCalledWith(123, "home", true);
  });

  it("clicking Away sub-tab calls hook with scope='away'", () => {
    render(<StandingsTab fixtureId={123} enabled />);
    const awayBtn = screen.getByRole("tab", { name: "Away" });
    fireEvent.click(awayBtn);
    expect(mockUseMatchDetailStandings).toHaveBeenCalledWith(123, "away", true);
  });

  it("renders table with correct rows", () => {
    render(<StandingsTab fixtureId={123} enabled />);
    const rows = screen.getAllByRole("row");
    // 1 header row + 2 data rows
    expect(rows.length).toBe(3);
  });

  it("displays goal difference with + prefix for positive values", () => {
    render(<StandingsTab fixtureId={123} enabled />);
    expect(screen.getByText("+45")).toBeTruthy();
  });
});

describe("StandingsTab — disabled state", () => {
  it("calls hook with enabled=false when not active", () => {
    mockUseMatchDetailStandings.mockReturnValue({ data: null, isLoading: false, isError: false });
    render(<StandingsTab fixtureId={123} enabled={false} />);
    expect(mockUseMatchDetailStandings).toHaveBeenCalledWith(123, "overall", false);
  });
});
