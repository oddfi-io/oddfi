// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onchainOddsStore } from "@/stores/onchainOddsStore";
import type { OnchainMarket } from "@/types/onchain-betting";

const subscribeMock = vi.fn();

// 赔率源开关：默认 "ws" 让既有 WS 用例不变；REST 用例在块内临时切 "rest"。
// 用 getter 读 live binding，确保 hook 渲染时取到当前值。
let sourceMode: "rest" | "ws" = "ws";

vi.mock("@/lib/ws/odds-ws", () => ({
  oddsWs: {
    subscribe: (mid: string) => subscribeMock(mid),
    isDisabled: () => false,
    activeMarketIds: new Set<string>(),
  },
}));

vi.mock("@/lib/network-mode", () => ({
  get LIVE_ODDS_SOURCE() {
    return sourceMode;
  },
  IS_TESTNET: false,
}));

import { useLiveOddsForEntry } from "./useLiveOddsForEntry";

const CONTRACT_MID = "0x" + "a".repeat(64);

const MARKETS: OnchainMarket[] = [
  {
    fixture_id: 1,
    match_id: "0x" + "f".repeat(64),
    market_id: CONTRACT_MID,
    market_type: 0,
    line: 0,
    base_odds: [22900, 33600, 31700],
    status: "OPENED",
    quote_version: 1,
  },
];

beforeEach(() => {
  subscribeMock.mockReset();
  subscribeMock.mockReturnValue(vi.fn());
  onchainOddsStore.getState().reset();
  sourceMode = "ws";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useLiveOddsForEntry", () => {
  it("falls back to REST value when no markets", () => {
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: null,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    expect(result.current.displayValue).toBe("2.29");
    expect(result.current.isLive).toBe(false);
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("subscribes to contract marketId and returns REST until push arrives", () => {
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: MARKETS,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    expect(subscribeMock).toHaveBeenCalledWith(CONTRACT_MID);
    // No push yet → REST fallback
    expect(result.current.displayValue).toBe("2.29");
    expect(result.current.isLive).toBe(false);
  });

  it("shows live quotedOdds after push arrives", () => {
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: MARKETS,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    act(() => {
      onchainOddsStore.getState().applyUpdate(CONTRACT_MID, {
        baseOdds: ["22900", "33600", "31700"],
        quotedOdds: ["23500", "33000", "31500"],
        signal: 0,
        quoteVersion: 21,
        updatedAt: 1779371522,
      });
    });
    expect(result.current.displayValue).toBe("2.35");
    expect(result.current.isLive).toBe(true);
    expect(result.current.flashDirection).toBeNull(); // first push, no previous
  });

  it("DD-119: 红灯快照（未推送）→ signal=3（调用方据此锁定），isLive=false", () => {
    const redMarkets: OnchainMarket[] = [{ ...MARKETS[0], signal: 3 }];
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: redMarkets,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    // 已订阅但无推送 → 回退 RQ 快照 signal
    expect(result.current.signal).toBe(3);
    expect(result.current.isLive).toBe(false);
  });

  it("DD-119: WS 推送 signal=3 → live signal 覆盖（实时变红灯）", () => {
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: MARKETS, // 无 signal 快照
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    expect(result.current.signal).toBeNull();
    act(() => {
      onchainOddsStore.getState().applyUpdate(CONTRACT_MID, {
        baseOdds: ["22900", "33600", "31700"],
        quotedOdds: ["22900", "33600", "31700"],
        signal: 3,
        quoteVersion: 22,
        updatedAt: 1779371523,
      });
    });
    expect(result.current.signal).toBe(3);
    expect(result.current.isLive).toBe(true);
  });

  it("DD-119: lookup miss（无对应链上盘口）→ signal=null，不误锁", () => {
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: MARKETS, // 只有 1x2
        sportmonksMarketId: 6, // AH 无 market
        line: "-0.5",
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    expect(result.current.signal).toBeNull();
    expect(result.current.isLive).toBe(false);
  });

  it("flashes up when subsequent push raises the outcome odd", () => {
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: MARKETS,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    act(() => {
      onchainOddsStore.getState().applyUpdate(CONTRACT_MID, {
        baseOdds: ["22900", "33600", "31700"],
        quotedOdds: ["22900", "33600", "31700"],
        signal: 0,
        quoteVersion: 20,
        updatedAt: 1779371520,
      });
    });
    act(() => {
      onchainOddsStore.getState().applyUpdate(CONTRACT_MID, {
        baseOdds: ["22900", "33600", "31700"],
        quotedOdds: ["23500", "33000", "31500"], // Home went 22900 → 23500 (up)
        signal: 0,
        quoteVersion: 21,
        updatedAt: 1779371522,
      });
    });
    expect(result.current.flashDirection).toBe("up");
    expect(result.current.displayValue).toBe("2.35");
  });

  it("flashes down when subsequent push lowers the outcome odd", () => {
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: MARKETS,
        sportmonksMarketId: 1,
        outcomeLabel: "Away",
        fallbackValue: "3.17",
      })
    );
    act(() => {
      onchainOddsStore.getState().applyUpdate(CONTRACT_MID, {
        baseOdds: ["22900", "33600", "31700"],
        quotedOdds: ["22900", "33600", "31700"],
        signal: 0,
        quoteVersion: 20,
        updatedAt: 1779371520,
      });
    });
    act(() => {
      onchainOddsStore.getState().applyUpdate(CONTRACT_MID, {
        baseOdds: ["22900", "33600", "31700"],
        quotedOdds: ["22900", "33600", "30900"], // Away 31700 → 30900 (down)
        signal: 0,
        quoteVersion: 21,
        updatedAt: 1779371522,
      });
    });
    expect(result.current.flashDirection).toBe("down");
    expect(result.current.displayValue).toBe("3.09");
  });

  // REST 快照 quoted_odds 优先（/market/onchain WCL 上浮价；行情 fallbackValue 仅在快照缺失时使用）
  it("快照含 quoted_odds → WS 未就绪时优先展示快照价而非行情值", () => {
    const quotedMarkets: OnchainMarket[] = [{ ...MARKETS[0], quoted_odds: [21500, 34000, 31000] }];
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: quotedMarkets,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    expect(result.current.displayValue).toBe("2.15");
    expect(result.current.isLive).toBe(false);
  });

  it("快照 quoted_odds 非法（0）→ 仍回退行情 fallbackValue", () => {
    const zeroMarkets: OnchainMarket[] = [{ ...MARKETS[0], quoted_odds: [0, 0, 0] }];
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: zeroMarkets,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    expect(result.current.displayValue).toBe("2.29");
  });

  it("WS 数据 stale 后回退快照 quoted_odds（而非行情值）", () => {
    const quotedMarkets: OnchainMarket[] = [{ ...MARKETS[0], quoted_odds: [21500, 34000, 31000] }];
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: quotedMarkets,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    act(() => {
      onchainOddsStore.getState().applyUpdate(CONTRACT_MID, {
        baseOdds: ["22900"],
        quotedOdds: ["23500"],
        signal: 0,
        quoteVersion: 21,
        updatedAt: 1779371522,
      });
      onchainOddsStore.getState().markAllStale();
    });
    expect(result.current.displayValue).toBe("2.15");
    expect(result.current.isLive).toBe(false);
  });

  it("falls back to REST when data is stale", () => {
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: MARKETS,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    act(() => {
      onchainOddsStore.getState().applyUpdate(CONTRACT_MID, {
        baseOdds: ["22900"],
        quotedOdds: ["23500"],
        signal: 0,
        quoteVersion: 21,
        updatedAt: 1779371522,
      });
      onchainOddsStore.getState().markAllStale();
    });
    expect(result.current.displayValue).toBe("2.29");
    expect(result.current.isLive).toBe(false);
  });

  it("does not subscribe when lookup miss (unknown sportmonks market_id)", () => {
    renderHook(() =>
      useLiveOddsForEntry({
        markets: MARKETS,
        sportmonksMarketId: 999,
        outcomeLabel: "Home",
        fallbackValue: "—",
      })
    );
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("does not subscribe when enabled=false", () => {
    renderHook(() =>
      useLiveOddsForEntry({
        markets: MARKETS,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
        enabled: false,
      })
    );
    expect(subscribeMock).not.toHaveBeenCalled();
  });
});

describe("useLiveOddsForEntry · REST 模式（LIVE_ODDS_SOURCE=rest，赛中以 sports_all 为准）", () => {
  beforeEach(() => {
    sourceMode = "rest";
  });

  it("不订阅 WS，显示 sports_all 兜底值（即便有链上 quoted_odds 也以 fallbackValue 为准）", () => {
    // markets 带 quoted_odds（链上 2.15）；rest 模式应忽略它，显示 fallbackValue（sports_all 2.29）
    const quotedMarkets: OnchainMarket[] = [{ ...MARKETS[0], quoted_odds: [21500, 34000, 31000] }];
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: quotedMarkets,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(result.current.displayValue).toBe("2.29");
    expect(result.current.isLive).toBe(false);
  });

  it("即便有 WS 推送也不订阅、不取 WS 值（WS 让位）", () => {
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: MARKETS,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    act(() => {
      onchainOddsStore.getState().applyUpdate(CONTRACT_MID, {
        baseOdds: ["22900", "33600", "31700"],
        quotedOdds: ["23500", "33000", "31500"],
        signal: 0,
        quoteVersion: 21,
        updatedAt: 1779371522,
      });
    });
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(result.current.displayValue).toBe("2.29"); // 始终 sports_all 兜底值
    expect(result.current.isLive).toBe(false);
  });

  it("signal（红灯锁定）仍读链上快照", () => {
    const redMarkets: OnchainMarket[] = [{ ...MARKETS[0], signal: 3 }];
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: redMarkets,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "2.29",
      })
    );
    expect(result.current.signal).toBe(3);
  });

  it("fallbackValue（sports_all）上涨 → flashDirection=up + signature 递增", () => {
    const initial = {
      markets: MARKETS,
      sportmonksMarketId: 1,
      outcomeLabel: "Home" as const,
      fallbackValue: "2.29",
    };
    const { result, rerender } = renderHook((props: typeof initial) => useLiveOddsForEntry(props), {
      initialProps: initial,
    });
    expect(result.current.flashDirection).toBeNull(); // 首帧无前值，不闪
    const sig0 = result.current.flashSignature;
    rerender({ ...initial, fallbackValue: "2.35" });
    expect(result.current.flashDirection).toBe("up");
    expect(result.current.displayValue).toBe("2.35");
    expect(result.current.flashSignature).toBeGreaterThan(sig0);
  });

  it("fallbackValue（sports_all）下跌 → flashDirection=down", () => {
    const initial = {
      markets: MARKETS,
      sportmonksMarketId: 1,
      outcomeLabel: "Away" as const,
      fallbackValue: "3.17",
    };
    const { result, rerender } = renderHook((props: typeof initial) => useLiveOddsForEntry(props), {
      initialProps: initial,
    });
    rerender({ ...initial, fallbackValue: "3.09" });
    expect(result.current.flashDirection).toBe("down");
    expect(result.current.displayValue).toBe("3.09");
  });

  it("fallbackValue 为 — 时不闪、不报错", () => {
    const { result } = renderHook(() =>
      useLiveOddsForEntry({
        markets: null,
        sportmonksMarketId: 1,
        outcomeLabel: "Home",
        fallbackValue: "—",
      })
    );
    expect(result.current.displayValue).toBe("—");
    expect(result.current.flashDirection).toBeNull();
  });
});
