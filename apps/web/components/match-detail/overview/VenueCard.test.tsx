// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/**
 * VenueCard.test.tsx — DD-104 Batch 3 更新。
 * props 改为接 domain: MatchOverviewDomain，测试 fixture 直接构造 domain 形状。
 */
import type { MatchOverviewDomain } from "@/types/match-detail-domain";

// Mock all slide sub-components — we only test carousel navigation here
vi.mock("./venue/SlideGoalsAndScorers", () => ({
  default: () => <div data-testid="slide-goals">Goals Scored</div>,
}));
vi.mock("./venue/SlideVenue", () => ({
  default: () => <div data-testid="slide-venue">Venue Info</div>,
}));
vi.mock("./venue/SlideLeaguePosition", () => ({
  default: () => <div data-testid="slide-league">League Position</div>,
}));
vi.mock("./venue/SlidePeriodGoals", () => ({
  default: () => <div data-testid="slide-period">Period Goals</div>,
}));
vi.mock("./venue/SlideWinProbability", () => ({
  default: () => <div data-testid="slide-win">Win Probability</div>,
}));
vi.mock("./venue/SlideKickoff", () => ({
  default: () => <div data-testid="slide-kickoff">Kickoff</div>,
}));

import VenueCard from "./VenueCard";

/** 最小 MatchOverviewDomain fixture，满足 VenueCard 所需字段 */
const mockDomain: MatchOverviewDomain = {
  homeTeam: {
    participantId: 1,
    name: "Home FC",
    shortCode: "HOM",
    imagePath: "/images/home.png",
  },
  awayTeam: {
    participantId: 2,
    name: "Away FC",
    shortCode: "AWA",
    imagePath: "/images/away.png",
  },
  kickoff: { iso: "2026-06-11T18:00:00Z", timestamp: 1749657600 },
  venue: {
    name: "Stadium X",
    city: "City Y",
    capacity: 50000,
    imagePath: "",
    distanceKm: null,
  },
  seasonGoals: { home: null, away: null },
  topScorers: { home: null, away: null },
  standingsRank: { home: null, away: null },
  formPercentage: { home: 60, away: 45 },
  recentResults: { home: [], away: [] },
  periodGoals: [],
  winProbability: null,
  h2hSummary: { home_wins: 3, draws: 2, away_wins: 1 },
  referee: { name: "Ref Name" },
  managers: { home: { name: "Home Coach" }, away: { name: "Away Coach" } },
};

describe("VenueCard", () => {
  it("renders slide 1 content (Goals Scored) by default", () => {
    render(<VenueCard domain={mockDomain} />);
    expect(screen.getByTestId("slide-goals")).toBeTruthy();
    expect(screen.getByText("Goals Scored")).toBeTruthy();
  });

  it("clicking Next slide button advances to slide 2 (Venue)", () => {
    render(<VenueCard domain={mockDomain} />);
    const nextBtn = screen.getByRole("button", { name: /next slide/i });
    fireEvent.click(nextBtn);
    expect(screen.getByTestId("slide-venue")).toBeTruthy();
    // Slide 1 should be gone
    expect(screen.queryByTestId("slide-goals")).toBeNull();
  });

  it("renders 6 dot buttons for 6 slides", () => {
    render(<VenueCard domain={mockDomain} />);
    const dots = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.startsWith("Go to slide"));
    expect(dots.length).toBe(6);
  });

  it("first dot is the active (current) dot on initial render", () => {
    render(<VenueCard domain={mockDomain} />);
    // Clicking dot 1 should keep slide-goals visible
    const firstDot = screen.getByRole("button", { name: "Go to slide 1" });
    fireEvent.click(firstDot);
    expect(screen.getByTestId("slide-goals")).toBeTruthy();
  });

  it("clicking a dot navigates directly to that slide", () => {
    render(<VenueCard domain={mockDomain} />);
    // Slide 3 is LeaguePosition after Venue was inserted at index 1
    const dot3 = screen.getByRole("button", { name: "Go to slide 3" });
    fireEvent.click(dot3);
    expect(screen.getByTestId("slide-league")).toBeTruthy();
  });
});
