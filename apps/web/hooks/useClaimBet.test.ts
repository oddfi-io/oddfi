// @vitest-environment jsdom
/**
 * useClaimBet — DD-087 Batch 4 Claim mutation 测试
 *
 * 覆盖点：
 *  - 成功（already_claimed=false）→ toastSuccess + invalidateQueries（settled + balance）
 *  - already_claimed=true → toastInfo（不当错误）+ onClose 调用
 *  - 错误码 BET_NOT_FOUND → toastError("Bet not found")
 *  - 错误码 INVALID_BET_STATUS_FOR_CLAIM → toastError("Bet not eligible for claim")
 *  - 错误码 INVALID_CLAIM_AMOUNT / CLAIM_AMOUNT_MISMATCH → toastError("Claimable amount changed, please retry")
 *  - 错误码 INSUFFICIENT_CLAIMABLE_BALANCE / MULTIPLE_CLAIMABLE_BALANCE_ROWS → toastError("Service unavailable, contact support")
 *  - 错误码 CONCURRENCY_CLAIM_ERROR → toastError("Claim in progress, please wait")
 *  - 网络/未知错误 → toastError("Network error, please try again")
 *  - onSuccess 回调触发
 *  - refetch 触发：portfolio-history + balance query key
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  claimPrize: vi.fn(),
}));

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
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useClaimBet } from "./useClaimBet";
import { claimPrize } from "@/lib/api";
import { toastError, toastSuccess, toastInfo } from "@/lib/toast";

const mockClaimPrize = claimPrize as ReturnType<typeof vi.fn>;
const mockToastError = toastError as ReturnType<typeof vi.fn>;
const mockToastSuccess = toastSuccess as ReturnType<typeof vi.fn>;
const mockToastInfo = toastInfo as ReturnType<typeof vi.fn>;

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

// ─── 成功路径 ─────────────────────────────────────────────────────────────────

describe("useClaimBet — success", () => {
  it("成功领奖 → toastSuccess + invalidate settled + balance", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    mockClaimPrize.mockResolvedValueOnce({
      status: "CLAIMED",
      bet_id: 42,
      amount: 100,
      already_claimed: false,
    });

    const { result } = renderHook(() => useClaimBet({ onSuccess, onClose }), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ bet_id: 42 });
    });

    // toast
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastError).not.toHaveBeenCalled();

    // callbacks
    expect(onSuccess).toHaveBeenCalledWith(42, 100);
    expect(onClose).toHaveBeenCalledTimes(1);

    // invalidate portfolio-history（settled 列表）
    const historyCall = mockInvalidateQueries.mock.calls.find(
      (call) => call[0]?.queryKey?.[0] === "account" && typeof call[0]?.predicate === "function"
    );
    expect(historyCall).toBeDefined();

    // invalidate balance
    const balanceCall = mockInvalidateQueries.mock.calls.find(
      (call) => Array.isArray(call[0]?.queryKey) && call[0].queryKey.includes("balance")
    );
    expect(balanceCall).toBeDefined();
  });

  it("already_claimed=true → toastInfo（幂等命中）+ onClose，不走 onSuccess", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    mockClaimPrize.mockResolvedValueOnce({
      status: "CLAIMED",
      bet_id: 42,
      amount: 100,
      already_claimed: true,
    });

    const { result } = renderHook(() => useClaimBet({ onSuccess, onClose }), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ bet_id: 42 });
    });

    expect(mockToastInfo).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    // 幂等命中不 refetch
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});

// ─── 错误码映射 ───────────────────────────────────────────────────────────────

describe("useClaimBet — error code mapping", () => {
  const errorCases: Array<{ code: string; expectedMsg: string }> = [
    { code: "BET_NOT_FOUND", expectedMsg: "Bet not found" },
    { code: "INVALID_BET_STATUS_FOR_CLAIM", expectedMsg: "Bet not eligible for claim" },
    { code: "INVALID_CLAIM_AMOUNT", expectedMsg: "Claimable amount changed, please retry" },
    { code: "CLAIM_AMOUNT_MISMATCH", expectedMsg: "Claimable amount changed, please retry" },
    { code: "INSUFFICIENT_CLAIMABLE_BALANCE", expectedMsg: "Service unavailable, contact support" },
    {
      code: "MULTIPLE_CLAIMABLE_BALANCE_ROWS",
      expectedMsg: "Service unavailable, contact support",
    },
    { code: "CONCURRENCY_CLAIM_ERROR", expectedMsg: "Claim in progress, please wait" },
  ];

  errorCases.forEach(({ code, expectedMsg }) => {
    it(`错误码 ${code} → toastError("${expectedMsg}")`, async () => {
      // 模拟 ky HTTPError 携带 responseJSON
      mockClaimPrize.mockRejectedValueOnce({ responseJSON: { code } });

      const { result } = renderHook(() => useClaimBet({}), { wrapper: makeWrapper() });

      await act(async () => {
        result.current.mutate({ bet_id: 99 });
      });

      expect(mockToastError).toHaveBeenCalledWith(expectedMsg);
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  it("网络/未知错误 → toastError('Network error, please try again')", async () => {
    mockClaimPrize.mockRejectedValueOnce(new Error("Network failure"));

    const { result } = renderHook(() => useClaimBet({}), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ bet_id: 99 });
    });

    expect(mockToastError).toHaveBeenCalledWith("Network error, please try again");
  });

  it("responseJSON.code 为未知码 → toastError('Network error, please try again')", async () => {
    mockClaimPrize.mockRejectedValueOnce({ responseJSON: { code: "UNKNOWN_CODE" } });

    const { result } = renderHook(() => useClaimBet({}), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ bet_id: 99 });
    });

    expect(mockToastError).toHaveBeenCalledWith("Network error, please try again");
  });
});

// ─── refetch 触发验证 ─────────────────────────────────────────────────────────

describe("useClaimBet — refetch predicate", () => {
  it("invalidate predicate 匹配 portfolio-history key", async () => {
    mockClaimPrize.mockResolvedValueOnce({
      status: "CLAIMED",
      bet_id: 1,
      amount: 50,
      already_claimed: false,
    });

    const { result } = renderHook(() => useClaimBet({}), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ bet_id: 1 });
    });

    // 找到 predicate-based invalidate 调用
    const predicateCall = mockInvalidateQueries.mock.calls.find(
      (call) => typeof call[0]?.predicate === "function"
    );
    expect(predicateCall).toBeDefined();

    const predicate = predicateCall![0].predicate;
    // portfolio-history key 应该命中
    expect(predicate({ queryKey: ["account", "0xabc", "portfolio-history", {}] })).toBe(true);
    // portfolio-history-infinite key 也应该命中
    expect(predicate({ queryKey: ["account", "0xabc", "portfolio-history-infinite", {}] })).toBe(
      true
    );
    // balance key 不应该命中（由另一个 invalidate 处理）
    expect(predicate({ queryKey: ["account", "0xabc", "balance"] })).toBe(false);
  });
});
