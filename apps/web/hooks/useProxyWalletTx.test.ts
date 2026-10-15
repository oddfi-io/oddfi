// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock config before importing the hook
vi.mock("@/lib/proxy-wallet/config", () => ({
  PROXY_WALLET_MOCK: true,
}));

import { useProxyWalletTx } from "./useProxyWalletTx";
import type { TxPhase } from "./useProxyWalletTx";

describe("useProxyWalletTx", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("initializes with idle phase", () => {
    const { result } = renderHook(() =>
      useProxyWalletTx({ action: "swap" }),
    );
    expect(result.current.phase).toBe("idle");
    expect(result.current.txHash).toBeUndefined();
    expect(result.current.errorMessage).toBeUndefined();
  });

  it("progresses through swap phases: approving → executing → confirming → success", async () => {
    const { result } = renderHook(() =>
      useProxyWalletTx({ action: "swap" }),
    );

    const phases: TxPhase[] = [];

    // Start execute
    let executePromise: Promise<void>;
    await act(async () => {
      executePromise = result.current.execute();
    });

    // After execute starts, should be in approving
    expect(result.current.phase).toBe("approving");
    phases.push(result.current.phase);

    // Advance past approve delay (800ms)
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.phase).toBe("executing");
    phases.push(result.current.phase);

    // Advance past execute delay (1000ms)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.phase).toBe("confirming");
    expect(result.current.txHash).toBeDefined();
    phases.push(result.current.phase);

    // Advance past confirm delay (1200ms)
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.phase).toBe("success");
    phases.push(result.current.phase);

    expect(phases).toEqual(["approving", "executing", "confirming", "success"]);

    vi.useRealTimers();
  });

  it("skips approving phase for transfer action", async () => {
    const { result } = renderHook(() =>
      useProxyWalletTx({ action: "transfer" }),
    );

    await act(async () => {
      result.current.execute();
    });

    // Transfer skips approve — should go straight to executing
    expect(result.current.phase).toBe("executing");

    // Advance past execute delay (1000ms)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.phase).toBe("confirming");

    // Advance past confirm delay (1200ms)
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.phase).toBe("success");

    vi.useRealTimers();
  });

  it("reset returns to idle state", async () => {
    const { result } = renderHook(() =>
      useProxyWalletTx({ action: "swap" }),
    );

    // Start execution
    await act(async () => {
      result.current.execute();
    });
    expect(result.current.phase).toBe("approving");

    // Reset
    act(() => {
      result.current.reset();
    });
    expect(result.current.phase).toBe("idle");
    expect(result.current.txHash).toBeUndefined();
    expect(result.current.errorMessage).toBeUndefined();

    vi.useRealTimers();
  });

  it("sets txHash during confirming phase", async () => {
    const { result } = renderHook(() =>
      useProxyWalletTx({ action: "swap" }),
    );

    await act(async () => {
      result.current.execute();
    });

    // Advance to confirming
    await act(async () => {
      vi.advanceTimersByTime(800); // past approve
    });
    await act(async () => {
      vi.advanceTimersByTime(1000); // past execute
    });

    expect(result.current.phase).toBe("confirming");
    expect(result.current.txHash).toMatch(/^0x[a-f0-9]+$/);

    vi.useRealTimers();
  });
});
