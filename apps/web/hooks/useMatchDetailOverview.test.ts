// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";
import { useMatchDetailOverview } from "./useMatchDetailOverview";
import type { MatchDetailOverviewWire } from "@/types/match-detail";

vi.mock("@/lib/api", () => ({
  getMatchDetailOverview: vi.fn(),
}));
import { getMatchDetailOverview } from "@/lib/api";

const makeOverviewWire = (): MatchDetailOverviewWire => ({
  homeTeam: { participant_id: 1, name: "Man City", short_code: "MCI", image_path: "/mci.png" },
  awayTeam: { participant_id: 2, name: "Liverpool", short_code: "LIV", image_path: "/liv.png" },
  startingAt: "2026-06-11T18:00:00Z",
  starting_at_timestamp: 1781136000,
  venue: {
    name: "Etihad",
    city: "Manchester",
    capacity: 53400,
    image_path: "/e.jpg",
    distance_km: 5.2,
  },
  seasonGoals: { home: 72, away: 63 },
  topScorers: { home: null, away: null },
  standingsRank: { home: 1, away: 3 },
  formPercentage: { home: 85, away: 75 },
  recentResults: { home: ["W", "W", "W", "D", "W"], away: ["W", "D", "W", "W", "L"] },
  periodGoals: [{ period: 45, home_avg: 1.2, away_avg: 0.9 }],
  winProbability: { home: 58, draw: 24, away: 18 },
  h2hSummary: { home_wins: 7, draws: 3, away_wins: 4 },
  referee: { name: "Anthony Taylor" },
  managers: { home: { name: "Pep Guardiola" }, away: { name: "Arne Slot" } },
});

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  }
  return Wrapper;
}

describe("useMatchDetailOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isLoading=true initially (before first settle)", () => {
    vi.mocked(getMatchDetailOverview).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useMatchDetailOverview(1), { wrapper: makeWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("returns domain data after successful fetch", async () => {
    vi.mocked(getMatchDetailOverview).mockResolvedValue(makeOverviewWire());
    const { result } = renderHook(() => useMatchDetailOverview(1), { wrapper: makeWrapper() });

    await vi.waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data!.homeTeam.shortCode).toBe("MCI");
    expect(result.current.data!.awayTeam.shortCode).toBe("LIV");
    // adapter should convert: seasonGoals non-zero → kept
    expect(result.current.data!.seasonGoals).toEqual({ home: 72, away: 63 });
  });

  it("returns isError=true on fetch failure", async () => {
    vi.mocked(getMatchDetailOverview).mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useMatchDetailOverview(1), { wrapper: makeWrapper() });

    // retry: 1 in hook means we need to wait for both initial attempt + 1 retry
    await vi.waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 }
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("does not fetch when fixtureId is 0 (enabled=false)", () => {
    vi.mocked(getMatchDetailOverview).mockResolvedValue(makeOverviewWire());
    renderHook(() => useMatchDetailOverview(0), { wrapper: makeWrapper() });
    expect(getMatchDetailOverview).not.toHaveBeenCalled();
  });

  it("does not fetch when fixtureId is negative", () => {
    vi.mocked(getMatchDetailOverview).mockResolvedValue(makeOverviewWire());
    renderHook(() => useMatchDetailOverview(-1), { wrapper: makeWrapper() });
    expect(getMatchDetailOverview).not.toHaveBeenCalled();
  });

  it("applies zero-value adapter: standingsRank {0,0} → {null,null} in domain (each side independent)", async () => {
    const wire = { ...makeOverviewWire(), standingsRank: { home: 0, away: 0 } };
    vi.mocked(getMatchDetailOverview).mockResolvedValue(wire);
    const { result } = renderHook(() => useMatchDetailOverview(1), { wrapper: makeWrapper() });

    await vi.waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.data!.standingsRank).toEqual({ home: null, away: null });
  });
});
