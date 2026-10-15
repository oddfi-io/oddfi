// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// next-intl: t(key) → key（避免缺 provider）
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
// toast spy
const toastSuccessMock = vi.fn();
vi.mock("@/lib/toast", () => ({
  toastSuccess: (...args: unknown[]) => toastSuccessMock(...args),
  toastError: vi.fn(),
}));

import { usePendingOnchainBets } from "./usePendingOnchainBets";
import {
  usePendingOnchainBetsStore,
  type PendingOnchainBet,
} from "@/stores/pendingOnchainBetsStore";
import type { PortfolioBet } from "@/types/portfolio";
import type { BetSelection } from "@/types/betting";
import type { WaitForReceiptResult } from "@/lib/onchain/receipt-poller";
import type { DecodedRevert } from "@/lib/onchain/revert-decoder";

function makeBet(o: Partial<PendingOnchainBet> = {}): PendingOnchainBet {
  return {
    orderId: 1,
    txHash: "0xabc",
    selection: { id: "s1" } as BetSelection,
    bet: { id: "p1" } as PortfolioBet,
    status: "pending",
    createdAt: 1,
    ...o,
  };
}

const okReceipt: WaitForReceiptResult = { status: "success", blockNumber: 1n, txHash: "0xabc" };
const revertReceipt: WaitForReceiptResult = {
  status: "reverted",
  blockNumber: 1n,
  txHash: "0xabc",
};
const failDecoded: DecodedRevert = {
  kind: "open-position-exceeded",
  args: [],
  rawData: "0x",
  unwrapped: false,
};

describe("usePendingOnchainBets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePendingOnchainBetsStore.getState().clear();
  });

  it("receipt success → 标 confirmed，弹 T2 toast，并经 waitForOnchainBetReady 回填 onchainBetId", async () => {
    usePendingOnchainBetsStore.getState().add(makeBet({ orderId: 1 }));
    const deps = {
      waitForReceipt: vi.fn(async () => okReceipt),
      decodeRevertedTx: vi.fn(async (): Promise<DecodedRevert | null> => null),
      waitForOnchainBetReady: vi.fn(async () => ({ betId: "0xBET1" })),
    };
    renderHook(() => usePendingOnchainBets(deps));
    await waitFor(() =>
      expect(usePendingOnchainBetsStore.getState().byOrderId[1]?.status).toBe("confirmed")
    );
    expect(deps.decodeRevertedTx).not.toHaveBeenCalled();
    // T2：confirmed → 弹「已上链确认」toast（t mock 返回 key）
    expect(toastSuccessMock).toHaveBeenCalledWith("betOnchainConfirmed");
    // confirmed 后对账回填 onchainBetId（复用 order-poller）
    await waitFor(() =>
      expect(usePendingOnchainBetsStore.getState().byOrderId[1]?.onchainBetId).toBe("0xBET1")
    );
  });

  it("receipt reverted → 标 failed + failReasonKey（decode kind 映射 i18n key）", async () => {
    usePendingOnchainBetsStore.getState().add(makeBet({ orderId: 2 }));
    const deps = {
      waitForReceipt: vi.fn(async () => revertReceipt),
      decodeRevertedTx: vi.fn(async (): Promise<DecodedRevert | null> => failDecoded),
      waitForOnchainBetReady: vi.fn(async () => ({ betId: "0xX" })),
    };
    renderHook(() => usePendingOnchainBets(deps));
    await waitFor(() =>
      expect(usePendingOnchainBetsStore.getState().byOrderId[2]?.status).toBe("failed")
    );
    expect(usePendingOnchainBetsStore.getState().byOrderId[2]?.failReasonKey).toBe(
      "openPositionExceeded"
    );
    // failed 单不走 betId 对账
    expect(deps.waitForOnchainBetReady).not.toHaveBeenCalled();
  });

  it("waitForReceipt 抛错（超时）→ 留 pending，不误标失败", async () => {
    usePendingOnchainBetsStore.getState().add(makeBet({ orderId: 3 }));
    const deps = {
      waitForReceipt: vi.fn(async (): Promise<WaitForReceiptResult> => {
        throw new Error("timeout");
      }),
      decodeRevertedTx: vi.fn(async (): Promise<DecodedRevert | null> => null),
      waitForOnchainBetReady: vi.fn(async () => ({ betId: "0xX" })),
    };
    renderHook(() => usePendingOnchainBets(deps));
    await new Promise((r) => setTimeout(r, 10));
    expect(usePendingOnchainBetsStore.getState().byOrderId[3]?.status).toBe("pending");
    expect(deps.waitForOnchainBetReady).not.toHaveBeenCalled();
  });

  it("remount 竞态：跟踪进行中该单已被推进到终态 → 跳过，不重复 update / 不重复弹 T2", async () => {
    usePendingOnchainBetsStore.getState().add(makeBet({ orderId: 5 }));
    let resolveReceipt!: (r: WaitForReceiptResult) => void;
    const pending = new Promise<WaitForReceiptResult>((res) => {
      resolveReceipt = res;
    });
    const deps = {
      waitForReceipt: vi.fn(() => pending),
      decodeRevertedTx: vi.fn(async (): Promise<DecodedRevert | null> => null),
      waitForOnchainBetReady: vi.fn(async () => ({ betId: "0xX" })),
    };
    renderHook(() => usePendingOnchainBets(deps));
    await waitFor(() => expect(deps.waitForReceipt).toHaveBeenCalled());
    // 模拟另一次跟踪先把该单推进到 confirmed（并已弹过 T2）
    usePendingOnchainBetsStore.getState().update(5, { status: "confirmed" });
    toastSuccessMock.mockClear();
    // 本次跟踪的 receipt 此刻才 resolve → 守卫应跳过，不再 update/toast
    resolveReceipt(okReceipt);
    await new Promise((r) => setTimeout(r, 10));
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(usePendingOnchainBetsStore.getState().byOrderId[5]?.status).toBe("confirmed");
  });

  it("waitForOnchainBetReady 抛错（超时）→ confirmed 保留，onchainBetId 不回填（待 history 兜底）", async () => {
    usePendingOnchainBetsStore.getState().add(makeBet({ orderId: 4, status: "confirmed" }));
    const deps = {
      waitForReceipt: vi.fn(async () => okReceipt),
      decodeRevertedTx: vi.fn(async (): Promise<DecodedRevert | null> => null),
      waitForOnchainBetReady: vi.fn(async () => {
        throw new Error("order not ready timeout");
      }),
    };
    renderHook(() => usePendingOnchainBets(deps));
    await waitFor(() => expect(deps.waitForOnchainBetReady).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(usePendingOnchainBetsStore.getState().byOrderId[4]?.status).toBe("confirmed");
    expect(usePendingOnchainBetsStore.getState().byOrderId[4]?.onchainBetId).toBeUndefined();
  });
});
