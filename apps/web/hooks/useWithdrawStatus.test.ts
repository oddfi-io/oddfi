// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWithdrawStatus } from "./useWithdrawStatus";
import { WITHDRAW_STATUS, type WithdrawRecordInfo } from "@/types/auth";

const mockGetWithdrawRecordInfo = vi.fn();
vi.mock("@/lib/api", () => ({
  getWithdrawRecordInfo: (orders: string[]) => mockGetWithdrawRecordInfo(orders),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "TestQueryWrapper";
  return Wrapper;
}

function makeRecord(
  status: number,
  overrides: Partial<WithdrawRecordInfo> = {}
): WithdrawRecordInfo {
  return {
    order_sn: "WD-001",
    chain: "bsc",
    amount: "1",
    fee: "0.5",
    real_amount: "0.5",
    to_address: "0xabc",
    tx_hash: "",
    status,
    created_at: "2026-04-22T00:00:00Z",
    audit_at: "",
    finished_at: "",
    updated_at: "2026-04-22T00:00:00Z",
    ...overrides,
  };
}

describe("useWithdrawStatus", () => {
  beforeEach(() => {
    mockGetWithdrawRecordInfo.mockReset();
  });

  it("stays idle when orderSn is null", () => {
    const { result } = renderHook(() => useWithdrawStatus(null), { wrapper: createWrapper() });
    expect(result.current.record).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.isTerminal).toBe(false);
    expect(mockGetWithdrawRecordInfo).not.toHaveBeenCalled();
  });

  it("fetches and resolves as non-terminal for status=1 (PENDING_REVIEW)", async () => {
    mockGetWithdrawRecordInfo.mockResolvedValue({
      list: [makeRecord(WITHDRAW_STATUS.PENDING_REVIEW)],
      total: 1,
    });
    const { result } = renderHook(() => useWithdrawStatus("WD-001"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.record).not.toBeNull());
    expect(result.current.status).toBe(1);
    expect(result.current.isTerminal).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isFailed).toBe(false);
    expect(mockGetWithdrawRecordInfo).toHaveBeenCalledWith(["WD-001"]);
  });

  it("marks isSuccess=true and isTerminal=true for status=3 (COMPLETED)", async () => {
    mockGetWithdrawRecordInfo.mockResolvedValue({
      list: [
        makeRecord(WITHDRAW_STATUS.COMPLETED, {
          tx_hash: "0xabc",
          finished_at: "2026-04-22T01:00:00Z",
        }),
      ],
      total: 1,
    });
    const { result } = renderHook(() => useWithdrawStatus("WD-001"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isTerminal).toBe(true));
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isFailed).toBe(false);
    expect(result.current.record?.tx_hash).toBe("0xabc");
  });

  it.each([WITHDRAW_STATUS.REJECTED, WITHDRAW_STATUS.FAILED, WITHDRAW_STATUS.CANCELED])(
    "marks isFailed=true and isTerminal=true for terminal-fail status=%i",
    async (status) => {
      mockGetWithdrawRecordInfo.mockResolvedValue({ list: [makeRecord(status)], total: 1 });
      const { result } = renderHook(() => useWithdrawStatus("WD-001"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isTerminal).toBe(true));
      expect(result.current.isFailed).toBe(true);
      expect(result.current.isSuccess).toBe(false);
    }
  );

  it("yields record=null when backend returns empty list", async () => {
    mockGetWithdrawRecordInfo.mockResolvedValue({ list: [], total: 0 });
    const { result } = renderHook(() => useWithdrawStatus("WD-001"), { wrapper: createWrapper() });
    await waitFor(() => expect(mockGetWithdrawRecordInfo).toHaveBeenCalled());
    expect(result.current.record).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.isTerminal).toBe(false);
  });
});
