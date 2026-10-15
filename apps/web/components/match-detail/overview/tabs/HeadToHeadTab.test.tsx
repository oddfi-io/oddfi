// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock useMatchDetailH2H
const mockUseMatchDetailH2H = vi.fn();
vi.mock("@/hooks/useMatchDetailH2H", () => ({
  useMatchDetailH2H: (...args: unknown[]) => mockUseMatchDetailH2H(...args),
}));

// Mock useQueryClient
const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

// Mock H2H card sub-components
vi.mock("./h2h/H2HCardWinProb", () => ({
  H2HCardWinProb: () => <div data-testid="h2h-winprob">WinProb</div>,
}));

vi.mock("./h2h/H2HCardAverageGoals", () => ({
  H2HCardAverageGoals: ({ h2hSampleSize }: { h2hSampleSize: number }) => (
    <div data-testid="h2h-avggoals">AverageGoals — {h2hSampleSize} matches</div>
  ),
}));

vi.mock("./h2h/H2HCardForm", () => ({
  H2HCardForm: () => <div data-testid="h2h-form">Form</div>,
}));

import { HeadToHeadTab } from "./HeadToHeadTab";
import type { MatchH2HDomain } from "@/types/match-detail-domain";

const mockH2HData: MatchH2HDomain = {
  h2hSampleSize: 8,
  topScorers: { home: null, away: null },
  h2hAverageGoals: {
    scored: { home: 1.8, away: 1.5 },
    conceded: { home: 1.2, away: 1.4 },
  },
  h2hForm: {
    home_percentage: 62,
    away_percentage: 48,
    home_matches: [],
    away_matches: [],
  },
};

describe("HeadToHeadTab — loading state", () => {
  it("renders skeleton when isLoading=true", () => {
    mockUseMatchDetailH2H.mockReturnValue({ data: null, isLoading: true, isError: false });
    render(<HeadToHeadTab fixtureId={123} enabled />);
    expect(screen.getByTestId("h2h-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("h2h-winprob")).toBeNull();
  });
});

describe("HeadToHeadTab — error state", () => {
  it("renders error state when isError=true", () => {
    mockUseMatchDetailH2H.mockReturnValue({ data: null, isLoading: false, isError: true });
    render(<HeadToHeadTab fixtureId={123} enabled />);
    expect(screen.getByTestId("h2h-error")).toBeTruthy();
    expect(screen.getByTestId("h2h-retry-btn")).toBeTruthy();
    expect(screen.queryByTestId("h2h-winprob")).toBeNull();
  });

  it("clicking retry calls invalidateQueries with correct key", () => {
    mockUseMatchDetailH2H.mockReturnValue({ data: null, isLoading: false, isError: true });
    render(<HeadToHeadTab fixtureId={456} enabled />);
    fireEvent.click(screen.getByTestId("h2h-retry-btn"));
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["match-detail-h2h", 456],
    });
  });
});

describe("HeadToHeadTab — data state", () => {
  beforeEach(() => {
    mockUseMatchDetailH2H.mockReturnValue({
      data: mockH2HData,
      isLoading: false,
      isError: false,
    });
  });

  it("renders WinProb card on slide 0 (default)", () => {
    render(<HeadToHeadTab fixtureId={123} enabled />);
    expect(screen.getByTestId("h2h-winprob")).toBeTruthy();
    expect(screen.queryByTestId("h2h-avggoals")).toBeNull();
    expect(screen.queryByTestId("h2h-form")).toBeNull();
  });

  it("renders AverageGoals card on slide 1 with h2hSampleSize", () => {
    render(<HeadToHeadTab fixtureId={123} enabled />);
    // Navigate to slide 1
    const nextBtn = screen.getByLabelText("Next card");
    fireEvent.click(nextBtn);
    expect(screen.getByTestId("h2h-avggoals")).toBeTruthy();
    expect(screen.getByText(/8 matches/)).toBeTruthy();
    expect(screen.queryByTestId("h2h-winprob")).toBeNull();
  });

  it("renders Form card on slide 2", () => {
    render(<HeadToHeadTab fixtureId={123} enabled />);
    const nextBtn = screen.getByLabelText("Next card");
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    expect(screen.getByTestId("h2h-form")).toBeTruthy();
    expect(screen.queryByTestId("h2h-avggoals")).toBeNull();
  });

  it("prev button is disabled on slide 0", () => {
    render(<HeadToHeadTab fixtureId={123} enabled />);
    const prevBtn = screen.getByLabelText("Previous card");
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("next button is disabled on slide 2 (last)", () => {
    render(<HeadToHeadTab fixtureId={123} enabled />);
    const nextBtn = screen.getByLabelText("Next card");
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows slide counter 1/3 initially", () => {
    render(<HeadToHeadTab fixtureId={123} enabled />);
    expect(screen.getByText("1/3")).toBeTruthy();
  });

  it("shows slide counter 2/3 on slide 1", () => {
    render(<HeadToHeadTab fixtureId={123} enabled />);
    fireEvent.click(screen.getByLabelText("Next card"));
    expect(screen.getByText("2/3")).toBeTruthy();
  });
});

describe("HeadToHeadTab — disabled state", () => {
  it("calls hook with enabled=false when not active", () => {
    mockUseMatchDetailH2H.mockReturnValue({ data: null, isLoading: false, isError: false });
    render(<HeadToHeadTab fixtureId={123} enabled={false} />);
    expect(mockUseMatchDetailH2H).toHaveBeenCalledWith(123, false);
  });
});
