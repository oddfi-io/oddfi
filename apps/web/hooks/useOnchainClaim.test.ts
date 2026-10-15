// @vitest-environment jsdom
/**
 * useOnchainClaim — DD-105 Batch 7 §c Onchain Claim mutation 测试
 *
 * 覆盖点:
 *  - 成功 → toastSuccess + onSuccess(txHash) + onClose + invalidate portfolio-history + balance
 *  - ErrOnchainBetNotReady → toastInfo("Settlement still indexing on chain. Please try again in a moment.")
 *  - OnchainClaimRevertedError → toastError("Claim transaction reverted on chain")
 *  - ReceiptTimeoutError → toastError("Claim submitted but receipt timed out. Check My Bets...")
 *  - 普通 Error → toastError("Network error, please try again")
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/betting/onchain-claim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/betting/onchain-claim")>(
    "@/lib/betting/onchain-claim"
  );
  return {
    ...actual,
    submitOnchainClaim: vi.fn(),
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

import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useOnchainClaim } from "./useOnchainClaim";
import { submitOnchainClaim, OnchainClaimRevertedError } from "@/lib/betting/onchain-claim";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";
import { toastError, toastSuccess, toastInfo } from "@/lib/toast";

const mockSubmit = submitOnchainClaim as unknown as ReturnType<typeof vi.fn>;
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

describe("useOnchainClaim — success", () => {
  it("成功领奖 → toastSuccess + onSuccess(txHash) + invalidate", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    mockSubmit.mockResolvedValueOnce({ txHash: "0xdeadbeef" });

    const { result } = renderHook(() => useOnchainClaim({ onSuccess, onClose }), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ betId: "0xabc" });
    });

    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith("0xdeadbeef");
    expect(onClose).toHaveBeenCalledTimes(1);

    const historyCall = mockInvalidateQueries.mock.calls.find(
      (call) => typeof call[0]?.predicate === "function"
    );
    expect(historyCall).toBeDefined();
  });
});

describe("useOnchainClaim — error mapping", () => {
  it("ErrOnchainBetNotReady → toastInfo,不当 error", async () => {
    // isOnchainBetNotReadyError 走 Error message includes "not ready" 分支(不强依赖 HTTPError 实例化)
    mockSubmit.mockRejectedValueOnce(new Error("onchain bet id not ready for current user"));

    const { result } = renderHook(() => useOnchainClaim(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ betId: "0xabc" });
    });

    expect(mockToastInfo).toHaveBeenCalledWith(
      "Settlement still indexing on chain. Please try again in a moment."
    );
    expect(mockToastError).not.toHaveBeenCalled();
  });

  // DD-140 TC — revert toast 文案更新：补「稍后可在 Portfolio 重试」语义
  it("OnchainClaimRevertedError → toastError('Claim transaction reverted. You can retry in Portfolio shortly.')", async () => {
    mockSubmit.mockRejectedValueOnce(new OnchainClaimRevertedError("0xrevert"));

    const { result } = renderHook(() => useOnchainClaim(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ betId: "0xabc" });
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Claim transaction reverted. You can retry in Portfolio shortly."
    );
  });

  it("ReceiptTimeoutError → toastError('Claim submitted but receipt timed out...')", async () => {
    mockSubmit.mockRejectedValueOnce(new ReceiptTimeoutError("0xtimeout", 180000));

    const { result } = renderHook(() => useOnchainClaim(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ betId: "0xabc" });
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Claim submitted but receipt timed out. Check My Bets for the latest status."
    );
  });

  it("普通 Error → toastError('Network error, please try again')", async () => {
    mockSubmit.mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useOnchainClaim(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ betId: "0xabc" });
    });

    expect(mockToastError).toHaveBeenCalledWith("Network error, please try again");
  });
});

describe("useOnchainClaim — 后端 ENH-007 guard（relay 前同步拒绝，无 tx 上链）", () => {
  async function mutateWithError(error: unknown) {
    mockSubmit.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useOnchainClaim(), { wrapper: makeWrapper() });
    await act(async () => {
      result.current.mutate({ betId: "0xabc" });
    });
  }

  it("state=cashed_out → toastError('cashed out early, no payout to claim') + 刷新列表", async () => {
    await mutateWithError(new Error("onchain bet not claimable: state=cashed_out"));
    expect(mockToastError).toHaveBeenCalledWith(
      "This bet was cashed out early, no payout to claim"
    );
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("state=won_claimed → toastError('already been claimed') + 刷新列表", async () => {
    await mutateWithError(new Error("onchain bet not claimable: state=won_claimed"));
    expect(mockToastError).toHaveBeenCalledWith("Payout has already been claimed");
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("state=refunded（其余状态）→ toastError('not claimable') + 刷新列表", async () => {
    await mutateWithError(new Error("onchain bet not claimable: state=refunded"));
    expect(mockToastError).toHaveBeenCalledWith("This bet is not claimable");
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("503 state unverified → toastInfo 可重试，不刷新列表", async () => {
    await mutateWithError(new Error("onchain bet state unverified, try later"));
    expect(mockToastInfo).toHaveBeenCalledWith("Network busy, please try again later");
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
