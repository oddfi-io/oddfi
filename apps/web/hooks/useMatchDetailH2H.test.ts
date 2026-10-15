// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";
import { useMatchDetailH2H } from "./useMatchDetailH2H";
import type { MatchDetailH2HWire } from "@/types/match-detail";

vi.mock("@/lib/api", () => ({
  getMatchDetailH2H: vi.fn(),
}));
import { getMatchDetailH2H } from "@/lib/api";

const makeH2HWire = (): MatchDetailH2HWire => ({
  h2h_sample_size: 12,
  topScorers: { home: null, away: null },
  h2hAverageGoals: {
    scored: { home: 1.8, away: 1.4 },
    conceded: { home: 1.1, away: 1.3 },
  },
  h2hForm: {
    home_percentage: 65,
    away_percentage: 55,
    home_matches: [],
    away_matches: [],
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

describe("useMatchDetailH2H", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isLoading=true initially when enabled", () => {
    vi.mocked(getMatchDetailH2H).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useMatchDetailH2H(1, true), { wrapper: makeWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("returns domain data after successful fetch", async () => {
    vi.mocked(getMatchDetailH2H).mockResolvedValue(makeH2HWire());
    const { result } = renderHook(() => useMatchDetailH2H(1, true), { wrapper: makeWrapper() });

    await vi.waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data!.h2hSampleSize).toBe(12);
    expect(result.current.data!.h2hAverageGoals.scored.home).toBe(1.8);
  });

  it("returns isError=true on fetch failure", async () => {
    vi.mocked(getMatchDetailH2H).mockRejectedValue(new Error("500"));
    const { result } = renderHook(() => useMatchDetailH2H(1, true), { wrapper: makeWrapper() });

    await vi.waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 }
    );

    expect(result.current.data).toBeNull();
  });

  it("does not fetch when enabled=false", () => {
    vi.mocked(getMatchDetailH2H).mockResolvedValue(makeH2HWire());
    renderHook(() => useMatchDetailH2H(1, false), { wrapper: makeWrapper() });
    expect(getMatchDetailH2H).not.toHaveBeenCalled();
  });

  it("does not fetch when fixtureId=0 even if enabled=true", () => {
    vi.mocked(getMatchDetailH2H).mockResolvedValue(makeH2HWire());
    renderHook(() => useMatchDetailH2H(0, true), { wrapper: makeWrapper() });
    expect(getMatchDetailH2H).not.toHaveBeenCalled();
  });
});
