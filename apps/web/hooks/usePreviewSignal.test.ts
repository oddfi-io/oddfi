// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePreviewSignal } from "./usePreviewSignal";
import type { PreviewSignalRes } from "@/types/onchain-betting";

const mockPreviewSignal = vi.fn<(...args: unknown[]) => Promise<PreviewSignalRes>>();
vi.mock("@/lib/api", () => ({
  previewSignal: (...args: unknown[]) => mockPreviewSignal(...args),
}));

const captureExceptionMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

const greenRes: PreviewSignalRes = {
  signal: 0,
  acceptedAmount: "200000000000000000000",
  lockedOdds: "22900",
  partialFill: false,
  maxAcceptableAmount: "300000000000000000000",
  quoteVersion: "21",
  cachedAt: 1779544338,
  cacheTtlMs: 500,
  degraded: false,
};

const MARKET_ID = "0xabc";

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("usePreviewSignal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPreviewSignal.mockReset();
    captureExceptionMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("disabled / null 输入 → idle，不发请求", async () => {
    renderHook(() => usePreviewSignal({ marketId: null, outcome: null, amountWei: null }));
    await advance(500);
    expect(mockPreviewSignal).not.toHaveBeenCalled();
  });

  it("amountWei='0' → idle", async () => {
    renderHook(() => usePreviewSignal({ marketId: MARKET_ID, outcome: 0, amountWei: "0" }));
    await advance(500);
    expect(mockPreviewSignal).not.toHaveBeenCalled();
  });

  it("happy 路径：debounce 300ms 后发请求并 setState", async () => {
    mockPreviewSignal.mockResolvedValue(greenRes);
    const { result } = renderHook(() =>
      usePreviewSignal({ marketId: MARKET_ID, outcome: 0, amountWei: "100" })
    );
    expect(mockPreviewSignal).not.toHaveBeenCalled();

    await advance(300);

    expect(mockPreviewSignal).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(greenRes);
    expect(result.current.lastQuoteVersion).toBe("21");
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("快速连续变更 key → 仅最后一次落 state（stale guard）", async () => {
    const slow = { ...greenRes, lockedOdds: "20000", quoteVersion: "21" };
    const fast = { ...greenRes, lockedOdds: "30000", quoteVersion: "22" };
    mockPreviewSignal
      .mockImplementationOnce(
        () => new Promise<PreviewSignalRes>((resolve) => setTimeout(() => resolve(slow), 1000))
      )
      .mockResolvedValueOnce(fast);

    const { result, rerender } = renderHook(
      (args: Parameters<typeof usePreviewSignal>[0]) => usePreviewSignal(args),
      {
        initialProps: { marketId: MARKET_ID, outcome: 0, amountWei: "100" },
      }
    );
    await advance(300); // 触发第一次（慢）
    rerender({ marketId: MARKET_ID, outcome: 0, amountWei: "200" });
    await advance(300); // 触发第二次（快）
    await advance(2000); // 推到慢请求 resolve

    expect(result.current.data?.lockedOdds).toBe("30000");
    expect(result.current.lastQuoteVersion).toBe("22");
  });

  it("HTTPError 400 → kind=params + Sentry 上报", async () => {
    const { HTTPError } = await import("ky");
    const fakeResponse = new Response(
      JSON.stringify({ code: 1001, message: "invalid requestedAmount" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
    const fakeRequest = new Request("http://x");
    const err = new HTTPError(fakeResponse, fakeRequest, {} as never);
    mockPreviewSignal.mockRejectedValue(err);

    const { result } = renderHook(() =>
      usePreviewSignal({ marketId: MARKET_ID, outcome: 0, amountWei: "100" })
    );
    await advance(300);

    expect(result.current.error).toMatchObject({
      kind: "params",
      code: 1001,
      message: "invalid requestedAmount",
    });
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it("HTTPError 500 → kind=server + Sentry 上报", async () => {
    const { HTTPError } = await import("ky");
    const fakeResponse = new Response(JSON.stringify({ code: -1, message: "boom" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
    const fakeRequest = new Request("http://x");
    const err = new HTTPError(fakeResponse, fakeRequest, {} as never);
    mockPreviewSignal.mockRejectedValue(err);

    const { result } = renderHook(() =>
      usePreviewSignal({ marketId: MARKET_ID, outcome: 0, amountWei: "100" })
    );
    await advance(300);

    expect(result.current.error).toMatchObject({ kind: "server", status: 500 });
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it("TimeoutError → kind=network 且不上报 Sentry", async () => {
    const { TimeoutError } = await import("ky");
    mockPreviewSignal.mockRejectedValue(new TimeoutError({} as never));

    const { result } = renderHook(() =>
      usePreviewSignal({ marketId: MARKET_ID, outcome: 0, amountWei: "100" })
    );
    await advance(300);

    expect(result.current.error?.kind).toBe("network");
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("externalQuoteVersion 变化 → leading edge 立即发，不等防抖", async () => {
    mockPreviewSignal.mockResolvedValue(greenRes);
    const { rerender } = renderHook(
      (args: Parameters<typeof usePreviewSignal>[0]) => usePreviewSignal(args),
      {
        initialProps: {
          marketId: MARKET_ID,
          outcome: 0,
          amountWei: "100",
          externalQuoteVersion: "21",
        },
      }
    );
    await advance(300);
    expect(mockPreviewSignal).toHaveBeenCalledTimes(1);

    rerender({
      marketId: MARKET_ID,
      outcome: 0,
      amountWei: "100",
      externalQuoteVersion: "22",
    });
    // 仅 flush microtasks，不推进 debounce timer
    await advance(0);
    expect(mockPreviewSignal).toHaveBeenCalledTimes(2);
  });

  it("enabled=false 切换 → state 立即重置为 idle，abort 挂起请求", async () => {
    let resolveSlow: (v: PreviewSignalRes) => void = () => {};
    mockPreviewSignal.mockImplementationOnce(
      () =>
        new Promise<PreviewSignalRes>((resolve) => {
          resolveSlow = resolve;
        })
    );
    const { result, rerender } = renderHook(
      (args: Parameters<typeof usePreviewSignal>[0]) => usePreviewSignal(args),
      {
        initialProps: {
          marketId: MARKET_ID,
          outcome: 0,
          amountWei: "100",
          enabled: true,
        },
      }
    );
    await advance(300);
    expect(result.current.loading).toBe(true);

    rerender({ marketId: MARKET_ID, outcome: 0, amountWei: "100", enabled: false });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();

    resolveSlow(greenRes);
    await advance(0);
    expect(result.current.data).toBeNull();
  });
});
