// @vitest-environment jsdom
/**
 * useCancelBet — DD-087 Batch 3 Cancel mutation 测试
 *
 * 覆盖点：
 *  - 成功（ALL_SUCCESS）→ toastSuccess + invalidateQueries
 *  - 单条 FAILED（NOT_LIVE_STATUS）→ toastError("Bet already settled")
 *  - 单条 FAILED（未知错误码）→ toastError("Network error, please try again")
 *  - 网络层错误（onError）→ toastError("Network error, please try again")
 *  - 网络层错误（NOT_LIVE_STATUS code）→ toastError("Bet already settled")
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// mock 依赖
vi.mock("@/lib/api", () => ({
  cancelBets: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
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
import { useCancelBet } from "./usePortfolioBets";
import { cancelBets } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

const mockCancelBets = cancelBets as ReturnType<typeof vi.fn>;
const mockToastError = toastError as ReturnType<typeof vi.fn>;
const mockToastSuccess = toastSuccess as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  }
  return Wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInvalidateQueries.mockClear();
});

describe("useCancelBet", () => {
  it("成功（ALL_SUCCESS）→ toastSuccess + invalidateQueries", async () => {
    mockCancelBets.mockResolvedValue({
      final_status: "ALL_SUCCESS",
      results: [{ bet_id: 42, status: "SUCCESS" }],
    });

    const { result } = renderHook(() => useCancelBet(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(42);
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("Bet cancelled successfully");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["account", "0xabc"],
      predicate: expect.any(Function),
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("单条 FAILED（NOT_LIVE_STATUS）→ mutateAsync reject + toastError('Bet already settled')", async () => {
    mockCancelBets.mockResolvedValue({
      final_status: "PARTIAL_SUCCESS",
      results: [{ bet_id: 42, status: "FAILED", error: "NOT_LIVE_STATUS" }],
    });

    const { result } = renderHook(() => useCancelBet(), { wrapper: makeWrapper() });

    let threw = false;
    await act(async () => {
      try {
        await result.current.mutateAsync(42);
      } catch {
        threw = true;
      }
    });

    expect(threw).toBe(true);
    expect(mockToastError).toHaveBeenCalledWith("Bet already settled");
    expect(mockToastSuccess).not.toHaveBeenCalled();
    // 失败时不触发 invalidate
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it("单条 FAILED（未知错误码）→ mutateAsync reject + toastError('Network error, please try again')", async () => {
    mockCancelBets.mockResolvedValue({
      final_status: "PARTIAL_SUCCESS",
      results: [{ bet_id: 42, status: "FAILED", error: "BET_NOT_FOUND" }],
    });

    const { result } = renderHook(() => useCancelBet(), { wrapper: makeWrapper() });

    let threw = false;
    await act(async () => {
      try {
        await result.current.mutateAsync(42);
      } catch {
        threw = true;
      }
    });

    expect(threw).toBe(true);
    expect(mockToastError).toHaveBeenCalledWith("Network error, please try again");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("网络层错误（onError）→ toastError('Network error, please try again')", async () => {
    mockCancelBets.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useCancelBet(), { wrapper: makeWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync(42);
      } catch {
        // 预期会 throw，catch 不让测试失败
      }
    });

    expect(mockToastError).toHaveBeenCalledWith("Network error, please try again");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("网络层错误（responseJSON.code = NOT_LIVE_STATUS）→ toastError('Bet already settled')", async () => {
    const err = Object.assign(new Error("HTTP Error"), {
      responseJSON: { code: "NOT_LIVE_STATUS" },
    });
    mockCancelBets.mockRejectedValue(err);

    const { result } = renderHook(() => useCancelBet(), { wrapper: makeWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync(42);
      } catch {
        // 预期会 throw
      }
    });

    expect(mockToastError).toHaveBeenCalledWith("Bet already settled");
  });
});
