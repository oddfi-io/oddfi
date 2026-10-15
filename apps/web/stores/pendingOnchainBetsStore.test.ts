import { describe, it, expect, beforeEach } from "vitest";
import {
  usePendingOnchainBetsStore,
  toPendingBetList,
  type PendingOnchainBet,
} from "./pendingOnchainBetsStore";
import type { PortfolioBet } from "@/types/portfolio";
import type { BetSelection } from "@/types/betting";

function makeBet(overrides: Partial<PendingOnchainBet> = {}): PendingOnchainBet {
  const portfolioBet = { id: "pending-1", odds: "1.85" } as PortfolioBet;
  return {
    orderId: 1,
    txHash: "0xabc",
    selection: { id: "11-1-Home" } as BetSelection,
    bet: portfolioBet,
    status: "pending",
    createdAt: 1000,
    ...overrides,
  };
}

describe("pendingOnchainBetsStore", () => {
  beforeEach(() => {
    usePendingOnchainBetsStore.getState().clear();
  });

  it("add: 插入一笔，可按 orderId 取回", () => {
    usePendingOnchainBetsStore.getState().add(makeBet({ orderId: 5 }));
    expect(usePendingOnchainBetsStore.getState().byOrderId[5]?.status).toBe("pending");
  });

  it("add: 同 orderId 覆盖（幂等重试安全）", () => {
    const { add } = usePendingOnchainBetsStore.getState();
    add(makeBet({ orderId: 5, txHash: "0xold" }));
    add(makeBet({ orderId: 5, txHash: "0xnew" }));
    expect(Object.keys(usePendingOnchainBetsStore.getState().byOrderId)).toHaveLength(1);
    expect(usePendingOnchainBetsStore.getState().byOrderId[5]?.txHash).toBe("0xnew");
  });

  it("update: 推进状态 + 回填 onchainBetId", () => {
    const { add, update } = usePendingOnchainBetsStore.getState();
    add(makeBet({ orderId: 5 }));
    update(5, { status: "confirmed", onchainBetId: "0xbet" });
    const bet = usePendingOnchainBetsStore.getState().byOrderId[5];
    expect(bet?.status).toBe("confirmed");
    expect(bet?.onchainBetId).toBe("0xbet");
    // 未传的字段保持不变
    expect(bet?.txHash).toBe("0xabc");
  });

  it("update: status=failed 带 failReasonKey", () => {
    const { add, update } = usePendingOnchainBetsStore.getState();
    add(makeBet({ orderId: 5 }));
    update(5, { status: "failed", failReasonKey: "openPositionExceeded" });
    expect(usePendingOnchainBetsStore.getState().byOrderId[5]?.failReasonKey).toBe(
      "openPositionExceeded"
    );
  });

  it("update: orderId 不存在则无副作用", () => {
    const before = usePendingOnchainBetsStore.getState().byOrderId;
    usePendingOnchainBetsStore.getState().update(999, { status: "confirmed" });
    expect(usePendingOnchainBetsStore.getState().byOrderId).toBe(before);
  });

  it("remove: 移除指定单", () => {
    const { add, remove } = usePendingOnchainBetsStore.getState();
    add(makeBet({ orderId: 5 }));
    add(makeBet({ orderId: 6 }));
    remove(5);
    expect(usePendingOnchainBetsStore.getState().byOrderId[5]).toBeUndefined();
    expect(usePendingOnchainBetsStore.getState().byOrderId[6]).toBeDefined();
  });

  it("removeMany: 一次移除多笔，未命中保留", () => {
    const { add, removeMany } = usePendingOnchainBetsStore.getState();
    add(makeBet({ orderId: 5 }));
    add(makeBet({ orderId: 6 }));
    add(makeBet({ orderId: 7 }));
    removeMany([5, 7, 999]);
    const ids = Object.keys(usePendingOnchainBetsStore.getState().byOrderId);
    expect(ids).toEqual(["6"]);
  });

  it("removeMany: 空数组 / 全未命中 → 不改变引用（no-op）", () => {
    usePendingOnchainBetsStore.getState().add(makeBet({ orderId: 5 }));
    const before = usePendingOnchainBetsStore.getState().byOrderId;
    usePendingOnchainBetsStore.getState().removeMany([]);
    expect(usePendingOnchainBetsStore.getState().byOrderId).toBe(before);
    usePendingOnchainBetsStore.getState().removeMany([999]);
    expect(usePendingOnchainBetsStore.getState().byOrderId).toBe(before);
  });

  it("clear: 清空全部", () => {
    const { add, clear } = usePendingOnchainBetsStore.getState();
    add(makeBet({ orderId: 5 }));
    add(makeBet({ orderId: 6 }));
    clear();
    expect(Object.keys(usePendingOnchainBetsStore.getState().byOrderId)).toHaveLength(0);
  });

  it("toPendingBetList: 按 createdAt 倒序（最新在前）", () => {
    const list = toPendingBetList({
      1: makeBet({ orderId: 1, createdAt: 100 }),
      2: makeBet({ orderId: 2, createdAt: 300 }),
      3: makeBet({ orderId: 3, createdAt: 200 }),
    });
    expect(list.map((b) => b.orderId)).toEqual([2, 3, 1]);
  });
});
