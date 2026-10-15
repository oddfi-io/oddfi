// @vitest-environment jsdom
/**
 * useOnchainCashout — DD-137 链上 Cash Out hook 测试（REV-v1-A C-1 补齐）
 *
 * 覆盖点（镜像 useOnchainClaim.test.ts 基建）:
 *  - quote query: enabled=false / orderId 缺失时不触发 fetchCashoutQuote；enabled 时返回报价
 *  - mutation 成功 → Confirm 时取鲜报价（fetchCashoutQuote 再调一次）+ submit 入参正确
 *    + toastSuccess + onSuccess(txHash) + invalidate
 *  - CashoutQuoteUnavailableError(order-not-ready) → toastInfo
 *  - CashoutQuoteUnavailableError(degraded-quote) → toastError("Quote temporarily unavailable...")
 *  - OnchainCashoutRevertedError → toastError("Cancel transaction reverted on chain")
 *  - ReceiptTimeoutError → toastError("Cancel submitted but receipt timed out...")
 *  - quote-stale（QuoteExpired）→ toastError("Odds changed...") + 报价 refetch
 *  - not-cancellable（NotPending）→ toastError("can no longer be cancelled")
 *  - 普通 Error → toastError("Network error, please try again")
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/betting/onchain-cashout", async () => {
  const actual = await vi.importActual<typeof import("@/lib/betting/onchain-cashout")>(
    "@/lib/betting/onchain-cashout"
  );
  return {
    ...actual,
    fetchCashoutQuote: vi.fn(),
    submitOnchainCashout: vi.fn(),
  };
});

vi.mock("@/lib/toast", () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0xabc" }),
}));

const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  };
});

import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useOnchainCashout } from "./useOnchainCashout";
import {
  fetchCashoutQuote,
  submitOnchainCashout,
  CashoutQuoteUnavailableError,
  OnchainCashoutRevertedError,
} from "@/lib/betting/onchain-cashout";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";
import { toastError, toastSuccess, toastInfo } from "@/lib/toast";
import type { PortfolioBet } from "@/types/portfolio";

const mockFetchQuote = fetchCashoutQuote as unknown as ReturnType<typeof vi.fn>;
const mockSubmit = submitOnchainCashout as unknown as ReturnType<typeof vi.fn>;
const mockToastError = toastError as ReturnType<typeof vi.fn>;
const mockToastSuccess = toastSuccess as ReturnType<typeof vi.fn>;
const mockToastInfo = toastInfo as ReturnType<typeof vi.fn>;

const QUOTE = {
  estimate: { estimateOdd: "45", feeBps: 1000 as const, belowContractMin: false },
  quoteVersion: "12",
};

function makeBet(overrides: Partial<PortfolioBet> = {}): PortfolioBet {
  return {
    id: "onchain-14",
    isOnchain: true,
    onchainBetId: "0xbet",
    // DD-137 纯方案 B 报价输入（adapter 从 event_info 透传）
    cashoutFixtureId: 993021780890000,
    cashoutOutcome: 2,
    cashoutMarketTypeCode: 1,
    cashoutLineCode: 0,
    cashoutAcceptedAmountWei: "100000000000000000000",
    cashoutLockedOddsRaw: "25000",
    homeTeam: { name: "PSG", iconUrl: "" },
    awayTeam: { name: "Arsenal", iconUrl: "" },
    leagueTag: "",
    marketTag: "1X2",
    selectionTag: "Away",
    betAmount: "100",
    betAmountUsd: "100",
    potentialWin: "250",
    potentialWinUsd: "250",
    odds: "2.5",
    matchStatus: "upcoming",
    settlementStatus: "pending",
    matchTime: "2030-01-01T12:00:00Z",
    createdAt: "2026-06-06T00:00:00Z",
    ...overrides,
  } as PortfolioBet;
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  Wrapper.displayName = "TestQueryProvider";
  return Wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInvalidateQueries.mockClear();
});

describe("useOnchainCashout — quote query 门控", () => {
  it("enabled=false → 不触发 fetchCashoutQuote", async () => {
    renderHook(() => useOnchainCashout({ bet: makeBet(), enabled: false }), {
      wrapper: makeWrapper(),
    });
    // 给 query 一个调度窗口
    await act(async () => {});
    expect(mockFetchQuote).not.toHaveBeenCalled();
  });

  it("报价输入缺失（cashoutOutcome undefined）→ 即使 enabled 也不触发（按钮本不该亮）", async () => {
    renderHook(
      () => useOnchainCashout({ bet: makeBet({ cashoutOutcome: undefined }), enabled: true }),
      { wrapper: makeWrapper() }
    );
    await act(async () => {});
    expect(mockFetchQuote).not.toHaveBeenCalled();
  });

  it("falsy 防御：cashoutOutcome=0 仍触发报价（0 是合法 outcome）", async () => {
    mockFetchQuote.mockResolvedValue(QUOTE);
    renderHook(() => useOnchainCashout({ bet: makeBet({ cashoutOutcome: 0 }), enabled: true }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(mockFetchQuote).toHaveBeenCalled());
    expect(mockFetchQuote).toHaveBeenCalledWith(expect.objectContaining({ outcome: 0 }));
  });

  it("enabled + 报价输入齐 → 拉报价并返回 quote.data（方案 B 入参从 bet 取）", async () => {
    mockFetchQuote.mockResolvedValue(QUOTE);
    const { result } = renderHook(() => useOnchainCashout({ bet: makeBet(), enabled: true }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.quote.data).toBeDefined());
    expect(mockFetchQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        fixtureId: 993021780890000,
        outcome: 2,
        marketTypeCode: 1,
        lineCode: 0,
        matchTimeMs: Date.parse("2030-01-01T12:00:00Z"),
      })
    );
    expect(result.current.quote.data?.estimate.estimateOdd).toBe("45");
  });
});

describe("useOnchainCashout — mutation 成功", () => {
  it("Confirm 取鲜报价 → submit 入参（betId/quoteVersion/quotedAt 秒）→ toast + onSuccess + invalidate", async () => {
    const onSuccess = vi.fn();
    mockFetchQuote.mockResolvedValue(QUOTE);
    mockSubmit.mockResolvedValueOnce({ txHash: "0xdead" });

    const { result } = renderHook(
      () => useOnchainCashout({ bet: makeBet(), enabled: false, onSuccess }),
      { wrapper: makeWrapper() }
    );

    const before = Math.floor(Date.now() / 1000);
    await act(async () => {
      result.current.cashout.mutate();
    });
    const after = Math.floor(Date.now() / 1000);

    // enabled=false 下 quote query 不跑，这次 fetch 是 mutationFn 的取鲜调用
    expect(mockFetchQuote).toHaveBeenCalledTimes(1);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    const submitArg = mockSubmit.mock.calls[0][0];
    expect(submitArg.betId).toBe("0xbet");
    expect(submitArg.expectedQuoteVersion).toBe("12");
    expect(submitArg.quotedAt).toBeGreaterThanOrEqual(before);
    expect(submitArg.quotedAt).toBeLessThanOrEqual(after);

    expect(mockToastSuccess).toHaveBeenCalledWith("Bet cancelled successfully");
    expect(onSuccess).toHaveBeenCalledWith("0xdead");
    // portfolio-history predicate + balance 两次 invalidate
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    const predicateCall = mockInvalidateQueries.mock.calls.find(
      (call) => typeof call[0]?.predicate === "function"
    );
    expect(predicateCall).toBeDefined();
    // predicate 对 readonly unknown[] queryKey 直接 includes（REV-v1-A M-1 验证）
    const predicate = predicateCall![0].predicate as (q: {
      queryKey: readonly unknown[];
    }) => boolean;
    expect(
      predicate({ queryKey: ["account", "0xabc", "portfolio-history", { tab: "active" }] })
    ).toBe(true);
    expect(predicate({ queryKey: ["account", "0xabc", "balance"] })).toBe(false);
  });
});

describe("useOnchainCashout — error mapping", () => {
  async function mutateWithError(error: unknown) {
    mockFetchQuote.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useOnchainCashout({ bet: makeBet(), enabled: false }), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      result.current.cashout.mutate();
    });
    return result;
  }

  it("market-not-found → toastError('Quote temporarily unavailable...')", async () => {
    await mutateWithError(new CashoutQuoteUnavailableError("market-not-found"));
    expect(mockToastError).toHaveBeenCalledWith(
      "Quote temporarily unavailable, please try again later"
    );
  });

  it("no-live-quote（盘口锁定/降级）→ toastError('Quote temporarily unavailable...')", async () => {
    await mutateWithError(new CashoutQuoteUnavailableError("no-live-quote"));
    expect(mockToastError).toHaveBeenCalledWith(
      "Quote temporarily unavailable, please try again later"
    );
  });

  it("提交返回 ErrOnchainBetNotReady（not-ready）→ toastInfo（不当错误）", async () => {
    mockFetchQuote.mockResolvedValueOnce(QUOTE);
    mockSubmit.mockRejectedValueOnce(new Error("onchain bet id not ready for current user"));
    const { result } = renderHook(() => useOnchainCashout({ bet: makeBet(), enabled: false }), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      result.current.cashout.mutate();
    });
    expect(mockToastInfo).toHaveBeenCalledWith(
      "Bet still indexing on chain. Please try again in a moment."
    );
  });

  it("OnchainCashoutRevertedError（InvalidQuoteGuard: version/TTL/odds 无法区分）→ 可重试文案 + 报价 refetch", async () => {
    // BUG-026 §6.5：合约所有时间/版本 guard 都 revert 同一 InvalidQuoteGuard，前端无法区分 494/496/500。
    // 三类补救相同（报价失效→重取重试），故统一按可重试处理 + refetch，不再用死胡同「reverted on chain」。
    mockFetchQuote.mockResolvedValue(QUOTE);
    const { result } = renderHook(() => useOnchainCashout({ bet: makeBet(), enabled: true }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.quote.data).toBeDefined());

    mockFetchQuote.mockClear();
    mockSubmit.mockRejectedValueOnce(new OnchainCashoutRevertedError("0xrevert"));
    await act(async () => {
      result.current.cashout.mutate();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Quote expired, please review the refreshed quote and try again"
    );
    // onError 触发 quote.refetch（mutationFn 取鲜成功 1 次 + refetch 1 次）
    await waitFor(() => expect(mockFetchQuote).toHaveBeenCalledTimes(2));
  });

  it("ReceiptTimeoutError → toastError('Cancel submitted but receipt timed out...')", async () => {
    mockFetchQuote.mockResolvedValueOnce(QUOTE);
    mockSubmit.mockRejectedValueOnce(new ReceiptTimeoutError("0xtimeout", 180000));
    const { result } = renderHook(() => useOnchainCashout({ bet: makeBet(), enabled: false }), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      result.current.cashout.mutate();
    });
    expect(mockToastError).toHaveBeenCalledWith(
      "Cancel submitted but receipt timed out. Check My Bets for the latest status."
    );
  });

  it("QuoteExpired（quote-stale）→ toastError('Odds changed...') + 报价 refetch", async () => {
    // 首次 quote query 成功展示报价
    mockFetchQuote.mockResolvedValue(QUOTE);

    const { result } = renderHook(() => useOnchainCashout({ bet: makeBet(), enabled: true }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.quote.data).toBeDefined());

    // Confirm 取鲜失败（QuoteExpired）→ onError 触发 quote.refetch（refetch 给成功返回）
    mockFetchQuote.mockClear();
    mockFetchQuote.mockRejectedValueOnce(new Error("execution reverted: QuoteExpired"));
    mockFetchQuote.mockResolvedValue(QUOTE);

    await act(async () => {
      result.current.cashout.mutate();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Odds changed, please review the new quote and try again"
    );
    // mutationFn 取鲜失败 1 次 + onError 触发 quote.refetch 1 次
    await waitFor(() => expect(mockFetchQuote.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("NotPending（not-cancellable）→ toastError('can no longer be cancelled') + 刷新列表", async () => {
    await mutateWithError(new Error("execution reverted: NotPending"));
    expect(mockToastError).toHaveBeenCalledWith("This bet can no longer be cancelled");
    // 终态：刷新 portfolio-history，避免失效按钮残留可点
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
  });

  // ─── 后端 ENH-007 guard：relay 前同步拒绝（无 tx 上链） ──────────────────────

  it("guard state=cashed_out（already-cashed-out）→ toastError('already been cashed out') + 刷新列表", async () => {
    await mutateWithError(new Error("onchain bet not pending: state=cashed_out"));
    expect(mockToastError).toHaveBeenCalledWith("This bet has already been cashed out");
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("guard state=refunded（not-cancellable 其余终态）→ 泛用文案 + 刷新列表", async () => {
    await mutateWithError(new Error("onchain bet not pending: state=refunded"));
    expect(mockToastError).toHaveBeenCalledWith("This bet can no longer be cancelled");
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("503 state unverified（state-unverified）→ toastInfo 可重试，不刷新列表", async () => {
    await mutateWithError(new Error("onchain bet state unverified, try later"));
    expect(mockToastInfo).toHaveBeenCalledWith("Network busy, please try again later");
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it("普通 Error → toastError('Network error, please try again')", async () => {
    await mutateWithError(new Error("offline"));
    expect(mockToastError).toHaveBeenCalledWith("Network error, please try again");
  });
});
