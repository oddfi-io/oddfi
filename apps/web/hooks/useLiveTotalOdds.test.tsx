// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useLiveTotalOdds } from "./useLiveTotalOdds";
import { useBetSlipStore } from "@/stores/betSlipStore";
import { onchainOddsStore } from "@/stores/onchainOddsStore";
import type { BetSelection } from "@/types/betting";
import type { OnchainMarket } from "@/types/onchain-betting";

// Mock the getOnchainMarkets API to feed React Query.
const mockMarketsByFixture: Record<number, OnchainMarket[]> = {};
vi.mock("@/lib/api", () => ({
  getOnchainMarkets: vi.fn((fixtureId: number) =>
    Promise.resolve({ fixture_id: fixtureId, markets: mockMarketsByFixture[fixtureId] ?? [] })
  ),
}));

const FIXTURE_A = 19683241;
const MID_1X2_A = "0x" + "a".repeat(64);

function makeSel(overrides: Partial<BetSelection>): BetSelection {
  return {
    id: overrides.id ?? "sel-1",
    oddId: 1,
    fixtureId: FIXTURE_A,
    fixtureName: "A vs B",
    leagueName: "League",
    marketType: "1x2",
    marketDescription: "Fulltime Result",
    selection: "Home",
    displayLabel: "Team A",
    odds: "2.00",
    ...overrides,
  };
}

function wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useLiveTotalOdds (Batch 5c)", () => {
  beforeEach(() => {
    Object.keys(mockMarketsByFixture).forEach((k) => delete mockMarketsByFixture[Number(k)]);
    onchainOddsStore.getState().reset();
    useBetSlipStore.getState().clearAll();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("returns '1' for total when there are no selections", () => {
    const { result } = renderHook(() => useLiveTotalOdds(), { wrapper: wrap });
    expect(result.current.liveTotalOdds).toBe("1");
    expect(result.current.livePotentialWin).toBe("0");
    expect(result.current.hasLiveDeviation).toBe(false);
  });

  it("multiplies locked odds when no onchain market exists for any selection", () => {
    const sels: BetSelection[] = [
      makeSel({ id: "s1", odds: "1.50" }),
      makeSel({ id: "s2", odds: "2.40", fixtureId: 9999, selection: "Away" }),
    ];
    act(() => {
      useBetSlipStore.setState({ selections: sels, mode: "multi", multiAmount: "10" });
    });
    const { result } = renderHook(() => useLiveTotalOdds(), { wrapper: wrap });
    // 1.50 × 2.40 = 3.6
    expect(result.current.liveTotalOdds).toBe("3.6");
    // potential = 10 × 3.6 = 36
    expect(result.current.livePotentialWin).toBe("36");
    expect(result.current.hasLiveDeviation).toBe(false);
  });

  it("non-canonical outcome label (banner / team name) falls back to locked", () => {
    const sels: BetSelection[] = [
      makeSel({ id: "s1", odds: "3.00", selection: "Argentina" }), // non-canonical
    ];
    act(() => {
      useBetSlipStore.setState({ selections: sels, mode: "multi", multiAmount: "5" });
    });
    mockMarketsByFixture[FIXTURE_A] = [
      {
        fixture_id: FIXTURE_A,
        match_id: "0x" + "1".repeat(64),
        market_id: MID_1X2_A,
        market_type: 0,
        line: 0,
        base_odds: [40000, 30000, 25000],
        quote_version: 0,
        status: "OPENED",
      },
    ];
    onchainOddsStore.getState().applyUpdate(MID_1X2_A, {
      baseOdds: ["40000", "30000", "25000"],
      quotedOdds: ["50000", "30000", "20000"],
      signal: 0,
      quoteVersion: 1,
      updatedAt: 1,
    });
    const { result } = renderHook(() => useLiveTotalOdds(), { wrapper: wrap });
    expect(result.current.liveTotalOdds).toBe("3");
    expect(result.current.hasLiveDeviation).toBe(false);
  });

  it("multi mode: potentialWin = multiAmount × liveTotalOdds (locked path)", () => {
    const sels: BetSelection[] = [
      makeSel({ id: "s1", odds: "2.00" }),
      makeSel({ id: "s2", odds: "3.00", selection: "Away" }),
    ];
    act(() => {
      useBetSlipStore.setState({ selections: sels, mode: "multi", multiAmount: "100" });
    });
    const { result } = renderHook(() => useLiveTotalOdds(), { wrapper: wrap });
    expect(result.current.liveTotalOdds).toBe("6");
    expect(result.current.livePotentialWin).toBe("600");
  });

  it("single mode: potentialWin = Σ amount_i × live_i", () => {
    const sels: BetSelection[] = [
      makeSel({ id: "s1", odds: "2.00" }),
      makeSel({ id: "s2", odds: "3.00", selection: "Away" }),
    ];
    act(() => {
      useBetSlipStore.setState({
        selections: sels,
        mode: "single",
        amounts: { s1: "10", s2: "20" },
      });
    });
    const { result } = renderHook(() => useLiveTotalOdds(), { wrapper: wrap });
    // 10 × 2 + 20 × 3 = 20 + 60 = 80
    expect(result.current.livePotentialWin).toBe("80");
  });

  it("empty / invalid amount → potentialWin defaults to 0", () => {
    const sels: BetSelection[] = [makeSel({ id: "s1", odds: "2.00" })];
    act(() => {
      useBetSlipStore.setState({ selections: sels, mode: "multi", multiAmount: "" });
    });
    const { result } = renderHook(() => useLiveTotalOdds(), { wrapper: wrap });
    expect(result.current.livePotentialWin).toBe("0");
  });

  it("hasLiveDeviation flips true when live value differs from locked (numeric compare, not string)", async () => {
    // Cover REV-v3-A M1 fix: ensure cmp() catches numerically-equal-but-string-different fallthrough
    // by injecting a push that changes the actual value.
    const sels: BetSelection[] = [
      makeSel({
        id: "s1",
        odds: "2.29", // locked snapshot
        selection: "Home",
      }),
    ];
    act(() => {
      useBetSlipStore.setState({ selections: sels, mode: "multi", multiAmount: "100" });
    });
    mockMarketsByFixture[FIXTURE_A] = [
      {
        fixture_id: FIXTURE_A,
        match_id: "0x" + "1".repeat(64),
        market_id: MID_1X2_A,
        market_type: 0,
        line: 0,
        base_odds: [22900, 32800, 32400],
        quote_version: 0,
        status: "OPENED",
      },
    ];
    // Seed initial entry equal to locked (no deviation yet)
    onchainOddsStore.getState().applyUpdate(MID_1X2_A, {
      baseOdds: ["22900", "32800", "32400"],
      quotedOdds: ["22900", "32800", "32400"],
      signal: 0,
      quoteVersion: 1,
      updatedAt: 1,
    });
    const { result, rerender } = renderHook(() => useLiveTotalOdds(), { wrapper: wrap });
    // Wait for fetch + first derivation (live === locked → no deviation)
    await new Promise((r) => setTimeout(r, 0));
    rerender();
    // Now push a different value → live ("3.00") ≠ locked ("2.29")
    act(() => {
      onchainOddsStore.getState().applyUpdate(MID_1X2_A, {
        baseOdds: ["22900", "32800", "32400"],
        quotedOdds: ["30000", "32500", "32400"],
        signal: 0,
        quoteVersion: 2,
        updatedAt: 2,
      });
    });
    rerender();
    expect(result.current.hasLiveDeviation).toBe(true);
  });

  // DD-118 防御性 line_value：AH leg 在串单中也要走 line_value 路径
  it("AH parlay leg uses line_value to derive live odds (multi mode)", async () => {
    const FIXTURE_AH = 42;
    const MID_AH = "0x" + "b".repeat(64);
    mockMarketsByFixture[FIXTURE_AH] = [
      {
        fixture_id: FIXTURE_AH,
        match_id: "0x" + "2".repeat(64),
        market_id: MID_AH,
        market_type: 1, // AH
        line: 0, // lineID
        line_value: "-0.5",
        base_odds: [19000, 21000],
        quote_version: 0,
        status: "OPENED",
      },
    ];
    // 推送 live AH odds（"1.95" 给 Home 即 raw 19500）
    onchainOddsStore.getState().applyUpdate(MID_AH, {
      baseOdds: ["19000", "21000"],
      quotedOdds: ["19500", "20500"],
      signal: 0,
      quoteVersion: 1,
      updatedAt: 1,
    });

    const sels: BetSelection[] = [
      makeSel({ id: "s1", odds: "2.00", selection: "Home" }), // 1X2 → 走 locked
      makeSel({
        id: "s2",
        odds: "1.90",
        fixtureId: FIXTURE_AH,
        marketType: "asian_handicap",
        selection: "Home",
        handicap: "-0.5",
      }),
    ];
    act(() => {
      useBetSlipStore.setState({ selections: sels, mode: "multi", multiAmount: "100" });
    });
    const { result, rerender } = renderHook(() => useLiveTotalOdds(), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 0));
    rerender();
    // AH live = 1.95（来自 19500），1X2 locked = 2.00 → total = 2 × 1.95 = 3.9
    expect(Number(result.current.liveTotalOdds)).toBeCloseTo(3.9, 2);
    expect(result.current.hasLiveDeviation).toBe(true); // 1.90 locked vs 1.95 live
  });

  // 防御性：AH leg 后端缺 line_value → 该 leg 走 locked 不会破坏总赔率
  it("AH parlay leg falls back to locked odds when backend hasn't shipped line_value", async () => {
    const FIXTURE_AH = 43;
    mockMarketsByFixture[FIXTURE_AH] = [
      {
        fixture_id: FIXTURE_AH,
        match_id: "0x" + "3".repeat(64),
        market_id: "0x" + "c".repeat(64),
        market_type: 1,
        line: 0,
        // line_value undefined — 老 API
        base_odds: [19000, 21000],
        quote_version: 0,
        status: "OPENED",
      },
    ];
    const sels: BetSelection[] = [
      makeSel({ id: "s1", odds: "2.00", selection: "Home" }),
      makeSel({
        id: "s2",
        odds: "1.90",
        fixtureId: FIXTURE_AH,
        marketType: "asian_handicap",
        selection: "Home",
        handicap: "-0.5",
      }),
    ];
    act(() => {
      useBetSlipStore.setState({ selections: sels, mode: "multi", multiAmount: "100" });
    });
    const { result, rerender } = renderHook(() => useLiveTotalOdds(), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 0));
    rerender();
    // 两 leg 都走 locked → 2.00 × 1.90 = 3.8
    expect(Number(result.current.liveTotalOdds)).toBeCloseTo(3.8, 2);
    expect(result.current.hasLiveDeviation).toBe(false);
  });

  it("hasLiveDeviation stays false when string formats differ but values are equal (REV-v3-A M1 fix)", async () => {
    // sel.odds "3" vs formatContractOdds("30000") = "3.00" — numerically equal, must NOT trip flag
    const sels: BetSelection[] = [makeSel({ id: "s1", odds: "3", selection: "Home" })];
    act(() => {
      useBetSlipStore.setState({ selections: sels, mode: "multi", multiAmount: "10" });
    });
    mockMarketsByFixture[FIXTURE_A] = [
      {
        fixture_id: FIXTURE_A,
        match_id: "0x" + "1".repeat(64),
        market_id: MID_1X2_A,
        market_type: 0,
        line: 0,
        base_odds: [30000, 32800, 32400],
        quote_version: 0,
        status: "OPENED",
      },
    ];
    onchainOddsStore.getState().applyUpdate(MID_1X2_A, {
      baseOdds: ["30000", "32800", "32400"],
      quotedOdds: ["30000", "32500", "32400"],
      signal: 0,
      quoteVersion: 1,
      updatedAt: 1,
    });
    const { result, rerender } = renderHook(() => useLiveTotalOdds(), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 0));
    rerender();
    expect(result.current.hasLiveDeviation).toBe(false);
  });
});
