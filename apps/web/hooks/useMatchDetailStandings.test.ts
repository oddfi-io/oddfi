// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";
import { useMatchDetailStandings } from "./useMatchDetailStandings";
import type { MatchDetailStandingsWire } from "@/types/match-detail";

vi.mock("@/lib/api", () => ({
  getMatchDetailStandings: vi.fn(),
}));
import { getMatchDetailStandings } from "@/lib/api";

const makeRow = () => ({
  participant_id: 1,
  position: 1,
  result: "up" as const,
  points: 78,
  played: 34,
  won: 24,
  draw: 6,
  lost: 4,
  goal_difference: 45,
  team_name: "Man City",
  team_logo: "/mci.png",
  short_code: "MCI",
});

const makeStandingsWire = (): MatchDetailStandingsWire => ({
  league_name: "Premier League",
  season_name: "2025/2026",
  standings: {
    overall: [makeRow()],
    home: [{ ...makeRow(), position: 2, points: 40 }],
    away: [{ ...makeRow(), position: 3, points: 38 }],
  },
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

describe("useMatchDetailStandings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isLoading=true initially when enabled", () => {
    vi.mocked(getMatchDetailStandings).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useMatchDetailStandings(1, "overall", true), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.rows).toBeNull();
  });

  it("returns domain data after successful fetch", async () => {
    vi.mocked(getMatchDetailStandings).mockResolvedValue(makeStandingsWire());
    const { result } = renderHook(() => useMatchDetailStandings(1, "overall", true), {
      wrapper: makeWrapper(),
    });

    await vi.waitFor(() => {
      expect(result.current.rows).not.toBeNull();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.leagueName).toBe("Premier League");
    expect(result.current.seasonName).toBe("2025/2026");
    expect(result.current.rows![0].shortCode).toBe("MCI");
    expect(result.current.rows![0].goalDifference).toBe(45);
  });

  it("returns isError=true on fetch failure", async () => {
    vi.mocked(getMatchDetailStandings).mockRejectedValue(new Error("503"));
    const { result } = renderHook(() => useMatchDetailStandings(1, "overall", true), {
      wrapper: makeWrapper(),
    });

    await vi.waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 }
    );

    expect(result.current.rows).toBeNull();
  });

  it("does not fetch when enabled=false", () => {
    vi.mocked(getMatchDetailStandings).mockResolvedValue(makeStandingsWire());
    renderHook(() => useMatchDetailStandings(1, "overall", false), { wrapper: makeWrapper() });
    expect(getMatchDetailStandings).not.toHaveBeenCalled();
  });

  it("scope changes pick from byScope without triggering a new network request", async () => {
    // Backend returns all scopes in one request; scope changes are client-side picks only.
    vi.mocked(getMatchDetailStandings).mockResolvedValue(makeStandingsWire());

    const { result, rerender } = renderHook(
      ({ scope }: { scope: "overall" | "home" | "away" }) =>
        useMatchDetailStandings(1, scope, true),
      { wrapper: makeWrapper(), initialProps: { scope: "overall" as "overall" | "home" | "away" } }
    );

    await vi.waitFor(() => expect(result.current.rows).not.toBeNull());
    expect(result.current.rows![0].points).toBe(78); // overall row

    // Switch to "home" scope — should pick from byScope.home, NOT trigger new fetch
    rerender({ scope: "home" });
    expect(result.current.rows![0].points).toBe(40); // home row

    // Single fetch for the whole request
    expect(getMatchDetailStandings).toHaveBeenCalledTimes(1);
  });
});
