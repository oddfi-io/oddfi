// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

// 本文件验证 WS 渲染接线，固定走 "ws" 源（生产默认 "rest" 是 WS 让位的临时开关）。
vi.mock("@/lib/network-mode", () => ({ LIVE_ODDS_SOURCE: "ws", IS_TESTNET: false }));

import { LiveOdds } from "./LiveOdds";
import { onchainOddsStore } from "@/stores/onchainOddsStore";
import { resetOddsWsForTest } from "@/lib/ws/odds-ws";
import type { OnchainMarket } from "@/types/onchain-betting";

const MID = "0x" + "a".repeat(64);

const markets: OnchainMarket[] = [
  {
    fixture_id: 1,
    match_id: "0x" + "f".repeat(64),
    market_id: MID,
    market_type: 0, // 1X2
    line: 0,
    base_odds: [22900, 32800, 32400],
    quote_version: 0,
    status: "OPENED",
  },
];

describe("LiveOdds (Batch 5b render-prop wrapper)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_WS_ODDS_URL = "wss://test/odds-ws";
    onchainOddsStore.getState().reset();
    resetOddsWsForTest();
  });

  afterEach(() => {
    cleanup();
    resetOddsWsForTest();
    onchainOddsStore.getState().reset();
  });

  it("renders children with fallbackValue when no live data has arrived", () => {
    let renderedValue = "";
    render(
      <LiveOdds markets={markets} sportmonksMarketId={1} outcomeLabel="Home" fallbackValue="2.29">
        {(value) => {
          renderedValue = value;
          return <span data-testid="v">{value}</span>;
        }}
      </LiveOdds>
    );
    expect(renderedValue).toBe("2.29");
  });

  it("renders children with fallback when enabled=false (viewport gate)", () => {
    let renderedValue = "";
    onchainOddsStore.getState().applyUpdate(MID, {
      baseOdds: ["22900", "32800", "32400"],
      quotedOdds: ["24000", "32500", "32100"],
      signal: 0,
      quoteVersion: 5,
      updatedAt: 1,
    });
    render(
      <LiveOdds
        markets={markets}
        sportmonksMarketId={1}
        outcomeLabel="Home"
        fallbackValue="2.29"
        enabled={false}
      >
        {(value) => {
          renderedValue = value;
          return <span data-testid="v">{value}</span>;
        }}
      </LiveOdds>
    );
    expect(renderedValue).toBe("2.29");
  });

  it("renders children with live formatted value when push has arrived", async () => {
    let renderedValue = "";
    const { rerender } = render(
      <LiveOdds
        markets={markets}
        sportmonksMarketId={1}
        outcomeLabel="Home"
        fallbackValue="2.29"
        enabled={true}
      >
        {(value) => {
          renderedValue = value;
          return <span data-testid="v">{value}</span>;
        }}
      </LiveOdds>
    );
    // Initial — still fallback (no WS data yet)
    expect(renderedValue).toBe("2.29");
    // Inject store update (simulating push)
    act(() => {
      onchainOddsStore.getState().applyUpdate(MID, {
        baseOdds: ["22900", "32800", "32400"],
        quotedOdds: ["24000", "32500", "32100"],
        signal: 0,
        quoteVersion: 5,
        updatedAt: 1,
      });
    });
    // Force a re-render to pick up the store change via Zustand selector subscription
    rerender(
      <LiveOdds
        markets={markets}
        sportmonksMarketId={1}
        outcomeLabel="Home"
        fallbackValue="2.29"
        enabled={true}
      >
        {(value) => {
          renderedValue = value;
          return <span data-testid="v">{value}</span>;
        }}
      </LiveOdds>
    );
    expect(renderedValue).toBe("2.40");
  });

  it("provides a ref to the children — DOM element is attached when used", () => {
    let capturedRef: React.RefObject<HTMLDivElement | null> | null = null;
    render(
      <LiveOdds markets={markets} sportmonksMarketId={1} outcomeLabel="Away" fallbackValue="3.24">
        {(value, ref) => {
          capturedRef = ref;
          return (
            <div ref={ref} data-testid="wrap">
              {value}
            </div>
          );
        }}
      </LiveOdds>
    );
    expect(capturedRef).not.toBeNull();
    expect(capturedRef!.current).toBeInstanceOf(HTMLDivElement);
  });
});
