// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ─── vi.hoisted：确保 mock 变量在 vi.mock 工厂函数执行前已初始化 ──────────────
// vi.mock 会被 hoisting 到文件顶部，普通 const 会进入 TDZ（Temporal Dead Zone），
// 导致工厂函数内引用到 undefined。vi.hoisted 解决此问题。

const { mockGetQuote, mockGetRelayClient } = vi.hoisted(() => ({
  mockGetQuote: vi.fn(),
  mockGetRelayClient: vi.fn(),
}));

vi.mock("@/lib/relay/client", () => ({
  getRelayClient: mockGetRelayClient,
}));

import { useRelayQuote } from "./useRelayQuote";
import type { RelayQuoteParams } from "@/lib/relay/types";

// ─── fixtures ─────────────────────────────────────────────────────────────────

const BASE_PARAMS: RelayQuoteParams = {
  chainId: 42161, // Arbitrum
  currency: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // USDT on Arbitrum (6 dec)
  toChainId: 56, // BSC
  toCurrency: "0x55d398326f99059fF775485246999027B3197955", // USDT on BSC (18 dec)
  amount: "100000000", // 100 USDT in Arbitrum smallest unit
  user: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
};

const MOCK_QUOTE = { steps: [{ id: "approve" }, { id: "bridge" }] };

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Flush N rounds of microtasks.
 *
 * fetchQuote 内部有多个 await 点（dynamic import → getRelayClient → getQuote → setState），
 * vi.advanceTimersByTime 触发 debounce 后只有同步的 setState("loading") 立即执行，
 * 后续 async chain 需要手动 flush 微任务队列才能完成。
 */
async function flushMicrotasks(rounds = 8) {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

/** 触发 800ms 防抖 + flush fetchQuote 全部 async chain */
async function flushDebounce() {
  await act(async () => {
    // advanceTimersByTimeAsync 触发 debounce 并尝试 await timer callback Promise
    await vi.advanceTimersByTimeAsync(800);
    // 额外微任务轮次确保 fetchQuote async chain（dynamic import → getRelayClient → getQuote → setState）全部完成
    // 并让 React 18 内部调度器（MessageChannel/queueMicrotask）有机会提交状态更新
    await flushMicrotasks(20);
  });
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("useRelayQuote", () => {
  beforeAll(async () => {
    // 预热 Vitest 模块注册表：第一次动态 import("@/lib/relay/client") 需要走模块初始化流程，
    // 耗时足以超出 act() 的微任务排空窗口，导致前两个 flushDebounce 调用失败（状态卡在 "loading"）。
    // 在 beforeAll（真实计时器环境）中提前 import 一次，使后续测试的动态 import 命中缓存、同步返回。
    await import("@/lib/relay/client");
  });

  beforeEach(() => {
    // 不 fake setImmediate：Vitest 动态 import() 内部依赖真实 setImmediate 完成模块解析；
    // 若 setImmediate 被 fake，await import("@/lib/relay/client") 在测试首次运行时会卡住，
    // 导致 fetchQuote async chain 无法完成（状态永远停在 "loading"）
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
    });
    mockGetQuote.mockResolvedValue(MOCK_QUOTE);
    mockGetRelayClient.mockResolvedValue({ actions: { getQuote: mockGetQuote } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("params 为 null 时进入 idle 状态", () => {
    const { result } = renderHook(() => useRelayQuote(null));
    expect(result.current.status).toBe("idle");
  });

  it("800ms 防抖 — 计时器触发前不发起请求", async () => {
    renderHook(() => useRelayQuote(BASE_PARAMS));

    await act(async () => {
      vi.advanceTimersByTime(799);
    });

    expect(mockGetQuote).not.toHaveBeenCalled();
  });

  it("800ms 后过渡到 success 状态，返回 quote + expiresAt", async () => {
    const { result } = renderHook(() => useRelayQuote(BASE_PARAMS));

    await flushDebounce();

    expect(result.current.status).toBe("success");
    if (result.current.status === "success") {
      expect(result.current.quote).toEqual(MOCK_QUOTE);
      expect(result.current.expiresAt).toBeGreaterThan(Date.now());
    }
  });

  it("向 getQuote 传递正确参数（chainId / currency / tradeType）", async () => {
    renderHook(() => useRelayQuote(BASE_PARAMS));
    await flushDebounce();

    expect(mockGetQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 42161,
        currency: BASE_PARAMS.currency,
        toChainId: 56,
        toCurrency: BASE_PARAMS.toCurrency,
        amount: BASE_PARAMS.amount,
        user: BASE_PARAMS.user,
        tradeType: "EXACT_INPUT",
      })
    );
  });

  it("getQuote 抛出时过渡到 error 状态", async () => {
    mockGetQuote.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useRelayQuote(BASE_PARAMS));

    await flushDebounce();

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.error.message).toBe("Network error");
    }
  });

  it("params 切换为 null 时立即回到 idle", async () => {
    const { result, rerender } = renderHook(
      ({ params }: { params: RelayQuoteParams | null }) => useRelayQuote(params),
      { initialProps: { params: BASE_PARAMS } as { params: RelayQuoteParams | null } }
    );

    await flushDebounce();
    expect(result.current.status).toBe("success");

    rerender({ params: null });
    expect(result.current.status).toBe("idle");
  });

  it("28s TTL 到期后自动刷新 — getQuote 被调用第二次", async () => {
    renderHook(() => useRelayQuote(BASE_PARAMS));

    await flushDebounce();
    expect(mockGetQuote).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(28_000);
      await flushMicrotasks();
    });

    expect(mockGetQuote).toHaveBeenCalledTimes(2);
  });

  it("refundTo 下沉到 SDK options（不在 quote 顶层）", async () => {
    const paramsWithRefund: RelayQuoteParams = {
      ...BASE_PARAMS,
      refundTo: "0xRefundEOA000000000000000000000000000001",
    };
    renderHook(() => useRelayQuote(paramsWithRefund));
    await flushDebounce();

    expect(mockGetQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { refundTo: paramsWithRefund.refundTo },
      })
    );
    // refundTo 不应出现在顶层（按 SDK QuoteBodyOptions schema）
    const call = mockGetQuote.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call).not.toHaveProperty("refundTo");
  });

  it("refundTo 变化触发重新 fetch（deps 刷新）", async () => {
    const { rerender } = renderHook(
      ({ params }: { params: RelayQuoteParams }) => useRelayQuote(params),
      { initialProps: { params: BASE_PARAMS } as { params: RelayQuoteParams } }
    );
    await flushDebounce();
    expect(mockGetQuote).toHaveBeenCalledTimes(1);

    rerender({ params: { ...BASE_PARAMS, refundTo: "0xNewRefundAddress0000000000000000000000" } });
    await flushDebounce();

    expect(mockGetQuote).toHaveBeenCalledTimes(2);
  });

  it("卸载时清理定时器 — 无 setState 调用后报错", async () => {
    const { unmount } = renderHook(() => useRelayQuote(BASE_PARAMS));

    await flushDebounce();
    unmount();

    // 卸载后推进时间不应抛出错误
    await act(async () => {
      vi.advanceTimersByTime(28_000);
      await flushMicrotasks();
    });
  });
});
