// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";

import { OddsWsMockPanel } from "./OddsWsMockPanel";
import { onchainOddsStore } from "@/stores/onchainOddsStore";
import * as oddsWsModule from "@/lib/ws/odds-ws";

function setUrlFlag(value: string | null) {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete("mockOddsWs");
  else url.searchParams.set("mockOddsWs", value);
  window.history.replaceState(null, "", url.toString());
}

describe("OddsWsMockPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    onchainOddsStore.getState().reset();
    setUrlFlag(null);
    vi.spyOn(oddsWsModule.oddsWs, "activeMarketIds", "get").mockReturnValue(new Set());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders nothing when mockOddsWs flag is absent", () => {
    render(<OddsWsMockPanel />);
    expect(screen.queryByTestId("odds-ws-mock-panel")).toBeNull();
  });

  it("renders panel when ?mockOddsWs=1 present", () => {
    setUrlFlag("1");
    render(<OddsWsMockPanel />);
    expect(screen.getByTestId("odds-ws-mock-panel")).toBeTruthy();
    expect(screen.getByText(/无已订阅市场/)).toBeTruthy();
  });

  it("lists active marketIds from oddsWs.activeMarketIds", () => {
    setUrlFlag("1");
    const mid = "0x" + "a".repeat(64);
    vi.spyOn(oddsWsModule.oddsWs, "activeMarketIds", "get").mockReturnValue(new Set([mid]));
    render(<OddsWsMockPanel />);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByTestId(`mock-up-${mid}`)).toBeTruthy();
    expect(screen.getByTestId(`mock-down-${mid}`)).toBeTruthy();
    expect(screen.getByTestId(`mock-random-${mid}`)).toBeTruthy();
  });

  it("clicking ↑ injects an upward push (raw value increases)", () => {
    setUrlFlag("1");
    const mid = "0x" + "b".repeat(64);
    vi.spyOn(oddsWsModule.oddsWs, "activeMarketIds", "get").mockReturnValue(new Set([mid]));
    // seed initial entry so the panel has a current quotedOdds to scale
    onchainOddsStore.getState().applyUpdate(mid, {
      baseOdds: ["20000", "20000"],
      quotedOdds: ["20000", "20000"],
      signal: 0,
      quoteVersion: 1,
      updatedAt: 1,
    });
    render(<OddsWsMockPanel />);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.click(screen.getByTestId(`mock-up-${mid}`));
    const next = onchainOddsStore.getState().byMarketId[mid];
    expect(Number(next.quotedOdds[0])).toBeGreaterThan(20000);
    expect(next.quoteVersion).toBeGreaterThan(1);
  });

  it("clicking ↓ injects a downward push (raw value decreases, floored at 10000)", () => {
    setUrlFlag("1");
    const mid = "0x" + "c".repeat(64);
    vi.spyOn(oddsWsModule.oddsWs, "activeMarketIds", "get").mockReturnValue(new Set([mid]));
    onchainOddsStore.getState().applyUpdate(mid, {
      baseOdds: ["20000", "20000"],
      quotedOdds: ["20000", "20000"],
      signal: 0,
      quoteVersion: 1,
      updatedAt: 1,
    });
    render(<OddsWsMockPanel />);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.click(screen.getByTestId(`mock-down-${mid}`));
    const next = onchainOddsStore.getState().byMarketId[mid];
    expect(Number(next.quotedOdds[0])).toBeLessThan(20000);
    expect(Number(next.quotedOdds[0])).toBeGreaterThanOrEqual(10000);
  });
});
