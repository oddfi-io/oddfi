// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";
import { isLiveMoneylineState, toMoneylineTrend, useMoneylineHistory } from "./useMoneylineHistory";
import type { MoneylineHistoryResponse } from "@/types/moneyline";

vi.mock("@/lib/api", () => ({
  getMoneylineHistory: vi.fn(),
}));
import { getMoneylineHistory } from "@/lib/api";

const makePoint = (captured_at: string, normalized_pct: number, state_id = 1) => ({
  captured_at,
  value: "2.150",
  probability: normalized_pct,
  normalized_pct,
  state_id,
});

describe("toMoneylineTrend", () => {
  it("returns null when api response is null/undefined", () => {
    expect(toMoneylineTrend(null)).toBeNull();
    expect(toMoneylineTrend(undefined)).toBeNull();
  });

  it("returns null when all three legs are empty (parent should skip rendering)", () => {
    const api: MoneylineHistoryResponse = { home: [], draw: [], away: [], fixture: null };
    expect(toMoneylineTrend(api)).toBeNull();
  });

  it("maps captured_at → time and normalized_pct → value", () => {
    const api: MoneylineHistoryResponse = {
      home: [makePoint("2026-05-13T02:23:00Z", 47.5)],
      draw: [makePoint("2026-05-13T02:23:00Z", 27.5)],
      away: [makePoint("2026-05-13T02:23:00Z", 25.0)],
      fixture: { id: 1, state_id: 1, starting_at: "2026-05-13 22:00:00" },
    };
    const trend = toMoneylineTrend(api);
    expect(trend).not.toBeNull();
    expect(trend!.home).toEqual([{ time: "2026-05-13T02:23:00Z", value: 47.5 }]);
    expect(trend!.draw).toEqual([{ time: "2026-05-13T02:23:00Z", value: 27.5 }]);
    expect(trend!.away).toEqual([{ time: "2026-05-13T02:23:00Z", value: 25.0 }]);
  });

  it("keeps non-empty legs even if one leg is empty", () => {
    const api: MoneylineHistoryResponse = {
      home: [makePoint("2026-05-13T02:23:00Z", 50)],
      draw: [],
      away: [],
      fixture: null,
    };
    const trend = toMoneylineTrend(api);
    expect(trend).not.toBeNull();
    expect(trend!.home).toHaveLength(1);
    expect(trend!.draw).toEqual([]);
    expect(trend!.away).toEqual([]);
  });
});

describe("useMoneylineHistory · trend 引用稳定（ENH-031 B1.2）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("data 未变（react-query cache hit）→ rerender 不产生新 trend 引用", async () => {
    const sample: MoneylineHistoryResponse = {
      home: [makePoint("2026-05-13T02:23:00Z", 47.5)],
      draw: [makePoint("2026-05-13T02:23:00Z", 27.5)],
      away: [makePoint("2026-05-13T02:23:00Z", 25.0)],
      fixture: { id: 1, state_id: 1, starting_at: "2026-05-13 22:00:00" },
    };
    vi.mocked(getMoneylineHistory).mockResolvedValue(sample);

    const { result, rerender } = renderHook(() => useMoneylineHistory(1), {
      wrapper: makeWrapper(),
    });

    // 等首次数据落地
    await vi.waitFor(() => {
      expect(result.current.trend).not.toBeNull();
    });

    const firstTrend = result.current.trend;
    rerender();
    rerender();

    // 依赖 dataUpdatedAt 而非 query.data，命中 cache 后引用必须稳定
    expect(result.current.trend).toBe(firstTrend);
  });
});

describe("isLiveMoneylineState", () => {
  it("returns true for in-match state_ids matching backend moneylineLiveStates set", () => {
    // 与 oddfi-web-api/handler/moneyline.go moneylineLiveStates 对齐
    for (const stateId of [2, 3, 4, 6, 9, 21, 22, 23, 25]) {
      expect(isLiveMoneylineState(stateId)).toBe(true);
    }
  });

  it("returns false for pre-match and undefined state", () => {
    expect(isLiveMoneylineState(1)).toBe(false); // NS pre-match
    expect(isLiveMoneylineState(5)).toBe(false); // FT (终态)
    expect(isLiveMoneylineState(null)).toBe(false);
    expect(isLiveMoneylineState(undefined)).toBe(false);
  });
});
