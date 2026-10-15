// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onchainOddsStore } from "@/stores/onchainOddsStore";
import { WsDisabledError } from "@/lib/ws/types";

const subscribeMock = vi.fn();

vi.mock("@/lib/ws/odds-ws", () => ({
  oddsWs: {
    subscribe: (mid: string) => subscribeMock(mid),
    isDisabled: () => false,
    activeMarketIds: new Set<string>(),
  },
}));

import { useOnchainOdds } from "./useOnchainOdds";

const MID = "0x020368b0e5316baa9a48b3e7c77872b0e7ca0ffcfd2f18319ebea5b25e762164";

beforeEach(() => {
  subscribeMock.mockReset();
  onchainOddsStore.getState().reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useOnchainOdds status", () => {
  it("returns idle when marketId is empty", () => {
    const { result } = renderHook(() => useOnchainOdds({ marketId: null }));
    expect(result.current.status).toBe("idle");
    expect(result.current.data).toBeNull();
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("returns idle when enabled is false", () => {
    const { result } = renderHook(() => useOnchainOdds({ marketId: MID, enabled: false }));
    expect(result.current.status).toBe("idle");
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("returns invalid when marketId is malformed", () => {
    const { result } = renderHook(() => useOnchainOdds({ marketId: "bogus" }));
    expect(result.current.status).toBe("invalid");
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("subscribes and returns subscribed status when marketId is valid", () => {
    const unsubscribe = vi.fn();
    subscribeMock.mockReturnValue(unsubscribe);
    const { result } = renderHook(() => useOnchainOdds({ marketId: MID }));
    expect(subscribeMock).toHaveBeenCalledWith(MID);
    expect(result.current.status).toBe("subscribed");
  });

  it("returns disabled status when oddsWs throws WsDisabledError", () => {
    subscribeMock.mockImplementation(() => {
      throw new WsDisabledError("odds");
    });
    const { result } = renderHook(() => useOnchainOdds({ marketId: MID }));
    expect(result.current.status).toBe("disabled");
  });

  it("returns error status when oddsWs throws unknown error", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    subscribeMock.mockImplementation(() => {
      throw new Error("boom");
    });
    const { result } = renderHook(() => useOnchainOdds({ marketId: MID }));
    expect(result.current.status).toBe("error");
    warn.mockRestore();
  });
});

describe("useOnchainOdds lifecycle", () => {
  it("calls unsubscribe on unmount", () => {
    const unsubscribe = vi.fn();
    subscribeMock.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useOnchainOdds({ marketId: MID }));
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("re-subscribes when marketId changes", () => {
    const unsubscribe1 = vi.fn();
    const unsubscribe2 = vi.fn();
    subscribeMock.mockReturnValueOnce(unsubscribe1).mockReturnValueOnce(unsubscribe2);
    const MID2 = "0x" + "a".repeat(64);
    const { rerender } = renderHook(
      ({ mid }: { mid: string }) => useOnchainOdds({ marketId: mid }),
      {
        initialProps: { mid: MID },
      }
    );
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    rerender({ mid: MID2 });
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(subscribeMock).toHaveBeenCalledTimes(2);
    expect(subscribeMock).toHaveBeenLastCalledWith(MID2);
  });

  it("does not re-subscribe when same marketId rerenders", () => {
    subscribeMock.mockReturnValue(vi.fn());
    const { rerender } = renderHook(
      ({ mid }: { mid: string }) => useOnchainOdds({ marketId: mid }),
      {
        initialProps: { mid: MID },
      }
    );
    rerender({ mid: MID });
    rerender({ mid: MID });
    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });
});

describe("useOnchainOdds data binding", () => {
  it("returns store snapshot when push arrives", () => {
    subscribeMock.mockReturnValue(vi.fn());
    const { result } = renderHook(() => useOnchainOdds({ marketId: MID }));
    expect(result.current.data).toBeNull();
    act(() => {
      onchainOddsStore.getState().applyUpdate(MID, {
        baseOdds: ["22900"],
        quotedOdds: ["22900"],
        signal: 0,
        quoteVersion: 21,
        updatedAt: 1779371522,
      });
    });
    expect(result.current.data?.quoteVersion).toBe(21);
  });

  it("does not re-subscribe when marketId differs only by case (REV-v1-A M3)", () => {
    subscribeMock.mockReturnValue(vi.fn());
    const lower = MID;
    const upper = "0x" + MID.slice(2).toUpperCase();
    const { rerender } = renderHook(
      ({ mid }: { mid: string }) => useOnchainOdds({ marketId: mid }),
      {
        initialProps: { mid: lower },
      }
    );
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    rerender({ mid: upper });
    // Same normalized marketId → no needless unsubscribe/resubscribe cycle.
    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });

  it("uppercase marketId resolves to lowercase store key", () => {
    subscribeMock.mockReturnValue(vi.fn());
    const upper = "0x" + MID.slice(2).toUpperCase();
    const { result } = renderHook(() => useOnchainOdds({ marketId: upper }));
    act(() => {
      onchainOddsStore.getState().applyUpdate(MID, {
        baseOdds: ["22900"],
        quotedOdds: ["22900"],
        signal: 0,
        quoteVersion: 21,
        updatedAt: 1779371522,
      });
    });
    expect(result.current.data?.marketId).toBe(MID);
  });
});
