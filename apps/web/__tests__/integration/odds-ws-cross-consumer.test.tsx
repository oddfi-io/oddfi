// @vitest-environment jsdom
/**
 * DD-118 Batch 5d — cross-consumer integration test
 *
 * Verifies a single mock push propagates to:
 *   - useLiveOddsForEntry (powers OddsSection / OddsTable / TripleOddsGrid buttons)
 *   - useLiveTotalOdds   (powers BetSummary parlay total + potential win)
 *
 * Both consumers read from the same onchainOddsStore → applying one mock should
 * flip both in the same render.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, cleanup, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// 本集成测试验证 WS 跨消费者推送贯通，固定走 "ws" 源（生产默认 "rest" 是 WS 让位的临时开关）。
vi.mock("@/lib/network-mode", () => ({ LIVE_ODDS_SOURCE: "ws", IS_TESTNET: false }));

import { useLiveOddsForEntry } from "@/hooks/useLiveOddsForEntry";
import { useLiveTotalOdds } from "@/hooks/useLiveTotalOdds";
import { onchainOddsStore } from "@/stores/onchainOddsStore";
import { useBetSlipStore } from "@/stores/betSlipStore";
import { injectMockOddsPush } from "@/lib/ws/odds-ws";
import type { OnchainMarket } from "@/types/onchain-betting";
import type { BetSelection } from "@/types/betting";

const FIXTURE = 19683241;
const MID_1X2 = "0x" + "1".repeat(64);

const marketsByFixture: Record<number, OnchainMarket[]> = {
  [FIXTURE]: [
    {
      fixture_id: FIXTURE,
      match_id: "0x" + "f".repeat(64),
      market_id: MID_1X2,
      market_type: 0,
      line: 0,
      base_odds: [22900, 32800, 32400],
      quote_version: 0,
      status: "OPENED",
    },
  ],
};

vi.mock("@/lib/api", () => ({
  getOnchainMarkets: vi.fn((fid: number) =>
    Promise.resolve({ fixture_id: fid, markets: marketsByFixture[fid] ?? [] })
  ),
}));

let sharedClient: QueryClient;
function wrap({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={sharedClient}>{children}</QueryClientProvider>;
}

describe("DD-118 Batch 5d — cross-consumer push propagation", () => {
  beforeEach(() => {
    sharedClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } },
    });
    onchainOddsStore.getState().reset();
    useBetSlipStore.getState().clearAll();
    // Seed the entry server-side first (otherwise useOnchainOdds in useLiveOddsForEntry
    // never reports "subscribed" status under our test seam — but live still flips for total).
    onchainOddsStore.getState().applyUpdate(MID_1X2, {
      baseOdds: ["22900", "32800", "32400"],
      quotedOdds: ["22900", "32800", "32400"],
      signal: 0,
      quoteVersion: 1,
      updatedAt: 1,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("injectMockOddsPush updates useLiveTotalOdds (parlay aggregate)", async () => {
    const sel: BetSelection = {
      id: "s1",
      oddId: 1,
      fixtureId: FIXTURE,
      fixtureName: "A vs B",
      leagueName: "League",
      marketType: "1x2",
      marketDescription: "Fulltime Result",
      selection: "Home",
      displayLabel: "Team A",
      odds: "2.29",
    };
    act(() => {
      useBetSlipStore.setState({ selections: [sel], mode: "multi", multiAmount: "100" });
    });
    const { result, rerender } = renderHook(() => useLiveTotalOdds(), { wrapper: wrap });

    // Wait for React Query to resolve onchain markets fetch (mocked).
    await waitFor(() => {
      expect(Number(result.current.liveTotalOdds)).toBeCloseTo(2.29, 2);
    });

    // Inject upward push: 22900 → 30000 (raw) → 3.00x
    act(() => {
      injectMockOddsPush(MID_1X2, { quotedOdds: ["30000", "32500", "32400"] });
    });
    rerender();

    await waitFor(() => {
      expect(Number(result.current.livePotentialWin)).toBeGreaterThan(229);
    });
  });

  it("injectMockOddsPush flips useLiveOddsForEntry value when subscribed", async () => {
    process.env.NEXT_PUBLIC_WS_ODDS_URL = "wss://test/odds-ws";
    const { result, rerender } = renderHook(
      () =>
        useLiveOddsForEntry({
          markets: marketsByFixture[FIXTURE],
          sportmonksMarketId: 1,
          outcomeLabel: "Home",
          fallbackValue: "2.29",
          enabled: true,
        }),
      { wrapper: wrap }
    );

    // Wait for subscription to settle and initial seeded value to appear.
    await waitFor(() => {
      expect(result.current.displayValue).toBe("2.29");
    });

    // Inject upward push: 22900 → 30000 → "3.00"
    act(() => {
      injectMockOddsPush(MID_1X2, { quotedOdds: ["30000", "32500", "32400"] });
    });
    rerender();

    await waitFor(() => {
      expect(result.current.displayValue).toBe("3.00");
    });
    expect(result.current.flashDirection).toBe("up");
  });

  // DD-119：WS odds_updated 的 signal 实时贯通到 useLiveOddsForEntry.signal（详情页红灯锁定的数据源）
  it("injectMockOddsPush signal=3 → useLiveOddsForEntry.signal flips to 红灯", async () => {
    process.env.NEXT_PUBLIC_WS_ODDS_URL = "wss://test/odds-ws";
    const { result, rerender } = renderHook(
      () =>
        useLiveOddsForEntry({
          markets: marketsByFixture[FIXTURE],
          sportmonksMarketId: 1,
          outcomeLabel: "Home",
          fallbackValue: "2.29",
          enabled: true,
        }),
      { wrapper: wrap }
    );

    // beforeEach 已 seed signal=0（绿灯）
    await waitFor(() => {
      expect(result.current.signal).toBe(0);
    });

    // 注入红灯推送（odds 不变，仅 signal → 3）
    act(() => {
      injectMockOddsPush(MID_1X2, { signal: 3 });
    });
    rerender();

    await waitFor(() => {
      expect(result.current.signal).toBe(3);
    });
  });
});
