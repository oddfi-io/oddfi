// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// ─── Mock txWs singleton ──────────────────────────────────────

type SubscribeFn = (txHash: string, opts?: { timeoutMs?: number }) => Promise<unknown>;
type UnsubscribeFn = (txHash: string) => Promise<void>;

let subscribeMock: ReturnType<typeof vi.fn<SubscribeFn>>;
let unsubscribeMock: ReturnType<typeof vi.fn<UnsubscribeFn>>;

vi.mock("@/lib/ws/tx-ws", () => ({
  txWs: {
    subscribe: (txHash: string, opts?: { timeoutMs?: number }) => subscribeMock(txHash, opts),
    unsubscribe: (txHash: string) => unsubscribeMock(txHash),
    get activeSubs() {
      return new Set<string>();
    },
  },
}));

import { useTxStatus } from "./useTxStatus";
import type { TxFinalStatus } from "@/lib/ws/tx-ws";

// ─── Helpers ───────────────────────────────────────────────────

function makeDeferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  subscribeMock = vi.fn<SubscribeFn>();
  unsubscribeMock = vi.fn<UnsubscribeFn>(() => Promise.resolve());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────

describe("useTxStatus", () => {
  it("returns idle when txHash is undefined", () => {
    const { result } = renderHook(() => useTxStatus(undefined));
    expect(result.current).toEqual({ state: "idle" });
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("transitions subscribing → settled when server pushes terminal status", async () => {
    const deferred = makeDeferred<TxFinalStatus>();
    subscribeMock.mockReturnValue(deferred.promise);

    const { result } = renderHook(() => useTxStatus("0xaa"));
    expect(result.current.state).toBe("subscribing");
    expect(subscribeMock).toHaveBeenCalledWith("0xaa", undefined);

    await act(async () => {
      deferred.resolve({
        status: "success",
        tx_hash: "0xaa",
        block_number: 100,
        block_hash: "0xbb",
      });
    });

    await waitFor(() => {
      expect(result.current.state).toBe("settled");
    });
    if (result.current.state === "settled") {
      expect(result.current.result.status).toBe("success");
    }
  });

  it("transitions to error state when subscribe rejects", async () => {
    const deferred = makeDeferred<TxFinalStatus>();
    subscribeMock.mockReturnValue(deferred.promise);

    const { result } = renderHook(() => useTxStatus("0xcc"));
    await act(async () => {
      deferred.reject(new Error("WS service disabled"));
    });

    await waitFor(() => {
      expect(result.current.state).toBe("error");
    });
    if (result.current.state === "error") {
      expect(result.current.error.message).toContain("disabled");
    }
  });

  it("passes timeoutMs to subscribe", () => {
    const deferred = makeDeferred<TxFinalStatus>();
    subscribeMock.mockReturnValue(deferred.promise);
    renderHook(() => useTxStatus("0xdd", { timeoutMs: 30_000 }));
    expect(subscribeMock).toHaveBeenCalledWith("0xdd", { timeoutMs: 30_000 });
  });

  it("calls unsubscribe on unmount when not yet settled", async () => {
    const deferred = makeDeferred<TxFinalStatus>();
    subscribeMock.mockReturnValue(deferred.promise);
    const { unmount } = renderHook(() => useTxStatus("0xee"));
    unmount();
    expect(unsubscribeMock).toHaveBeenCalledWith("0xee");
  });

  it("does NOT call unsubscribe when already settled before unmount", async () => {
    const deferred = makeDeferred<TxFinalStatus>();
    subscribeMock.mockReturnValue(deferred.promise);
    const { result, unmount } = renderHook(() => useTxStatus("0xff"));
    await act(async () => {
      deferred.resolve({
        status: "success",
        tx_hash: "0xff",
        block_number: 1,
        block_hash: "0x00",
      });
    });
    await waitFor(() => expect(result.current.state).toBe("settled"));
    unmount();
    expect(unsubscribeMock).not.toHaveBeenCalled();
  });

  it("resubscribes when txHash changes", async () => {
    const d1 = makeDeferred<TxFinalStatus>();
    const d2 = makeDeferred<TxFinalStatus>();
    subscribeMock.mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);

    const { result, rerender } = renderHook(({ h }: { h: string | undefined }) => useTxStatus(h), {
      initialProps: { h: "0x11" as string | undefined },
    });
    expect(subscribeMock).toHaveBeenLastCalledWith("0x11", undefined);

    rerender({ h: "0x22" });
    expect(subscribeMock).toHaveBeenLastCalledWith("0x22", undefined);
    expect(unsubscribeMock).toHaveBeenCalledWith("0x11");

    await act(async () => {
      d2.resolve({
        status: "failed",
        tx_hash: "0x22",
        block_number: 200,
        block_hash: "0xab",
      });
    });
    await waitFor(() => expect(result.current.state).toBe("settled"));
    if (result.current.state === "settled") {
      expect(result.current.txHash).toBe("0x22");
    }
  });

  it("transitions to error on synchronous WsDisabledError throw", () => {
    subscribeMock.mockImplementation(() => {
      throw new Error("[WS] Service disabled: tx");
    });
    const { result } = renderHook(() => useTxStatus("0x33"));
    expect(result.current.state).toBe("error");
    if (result.current.state === "error") {
      expect(result.current.error.message).toContain("disabled");
    }
  });
});
