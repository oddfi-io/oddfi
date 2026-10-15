// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";
import { useMatchDetailLineups } from "./useMatchDetailLineups";
import type { MatchDetailLineupsWire } from "@/types/match-detail";

vi.mock("@/lib/api", () => ({
  getMatchDetailLineups: vi.fn(),
}));
import { getMatchDetailLineups } from "@/lib/api";

const makeLineupsWire = (): MatchDetailLineupsWire => ({
  lineups: {
    home: { team_id: 1, team_name: "Man City", formation: "4-2-3-1", players: [] },
    away: { team_id: 2, team_name: "Liverpool", formation: "4-3-3", players: [] },
  },
  available_at: "2026-06-11 17:00:00",
});

const makeLineupsNullWire = (): MatchDetailLineupsWire => ({
  lineups: null,
  available_at: "2026-06-11 17:00:00",
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

describe("useMatchDetailLineups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isLoading=true initially when enabled", () => {
    vi.mocked(getMatchDetailLineups).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useMatchDetailLineups(1, true), { wrapper: makeWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("returns domain data with lineups when available", async () => {
    vi.mocked(getMatchDetailLineups).mockResolvedValue(makeLineupsWire());
    const { result } = renderHook(() => useMatchDetailLineups(1, true), { wrapper: makeWrapper() });

    await vi.waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data!.lineups).not.toBeNull();
    expect(result.current.data!.lineups!.home.formation).toBe("4-2-3-1");
    expect(result.current.data!.lineups!.away.formation).toBe("4-3-3");
    // availableAt should be a Date parsed as UTC
    expect(result.current.data!.availableAt instanceof Date).toBe(true);
    expect(result.current.data!.availableAt.getUTCHours()).toBe(17);
  });

  it("returns domain data with null lineups (pre-match ≥ 1h)", async () => {
    vi.mocked(getMatchDetailLineups).mockResolvedValue(makeLineupsNullWire());
    const { result } = renderHook(() => useMatchDetailLineups(1, true), { wrapper: makeWrapper() });

    await vi.waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.data!.lineups).toBeNull();
  });

  it("returns isError=true on fetch failure", async () => {
    vi.mocked(getMatchDetailLineups).mockRejectedValue(new Error("404"));
    const { result } = renderHook(() => useMatchDetailLineups(1, true), { wrapper: makeWrapper() });

    await vi.waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 }
    );

    expect(result.current.data).toBeNull();
  });

  it("does not fetch when enabled=false", () => {
    vi.mocked(getMatchDetailLineups).mockResolvedValue(makeLineupsWire());
    renderHook(() => useMatchDetailLineups(1, false), { wrapper: makeWrapper() });
    expect(getMatchDetailLineups).not.toHaveBeenCalled();
  });

  it("does not fetch when fixtureId=0 even if enabled=true", () => {
    vi.mocked(getMatchDetailLineups).mockResolvedValue(makeLineupsWire());
    renderHook(() => useMatchDetailLineups(0, true), { wrapper: makeWrapper() });
    expect(getMatchDetailLineups).not.toHaveBeenCalled();
  });
});
