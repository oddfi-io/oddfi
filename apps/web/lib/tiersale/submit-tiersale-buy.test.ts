import { describe, it, expect, vi } from "vitest";
import {
  submitTierSaleBuy,
  isSlippageExceeded,
  TierSaleApproveRevertedError,
  TierSaleBuyRevertedError,
} from "./submit-tiersale-buy";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";

const okReceipt = (status: "success" | "reverted") => ({
  status,
  blockNumber: 1n,
  txHash: "0x" as `0x${string}`,
});

function makeDeps(over: Partial<Parameters<typeof submitTierSaleBuy>[1]> = {}) {
  return {
    approveTierSale: vi.fn().mockResolvedValue({ tx_hash: "0xapprove", order_id: 1 }),
    buyTierSale: vi.fn().mockResolvedValue({ tx_hash: "0xbuy", order_id: 2 }),
    waitForReceipt: vi.fn().mockResolvedValue(okReceipt("success")),
    ...over,
  };
}

describe("submitTierSaleBuy", () => {
  it("approve→poll→buy→poll 全成功，状态序列 + 返回 hash", async () => {
    const states: string[] = [];
    const deps = makeDeps();
    const res = await submitTierSaleBuy(
      {
        oddAmountWei: "100e18",
        usdtApproveWei: "1e18",
        nonce: "n1",
        onState: (s) => states.push(s),
      },
      deps
    );
    expect(states).toEqual([
      "approving",
      "approve_confirming",
      "buying",
      "buy_confirming",
      "success",
    ]);
    expect(deps.approveTierSale).toHaveBeenCalledWith("1e18");
    expect(deps.buyTierSale).toHaveBeenCalledWith({ odd_amount_wei: "100e18", nonce: "n1" });
    expect(res).toEqual({ approveTxHash: "0xapprove", buyTxHash: "0xbuy", orderId: 2 });
  });

  it("approve 空 tx_hash（已授权）→ 跳过 approve_confirming，直接 buy", async () => {
    const states: string[] = [];
    const deps = makeDeps({
      approveTierSale: vi.fn().mockResolvedValue({ tx_hash: "", order_id: 0 }),
    });
    await submitTierSaleBuy(
      { oddAmountWei: "1e18", usdtApproveWei: "1e18", nonce: "n", onState: (s) => states.push(s) },
      deps
    );
    expect(states).toEqual(["approving", "buying", "buy_confirming", "success"]);
    // 只在 buy 阶段等过一次 receipt（approve 短路不等）
    expect(deps.waitForReceipt).toHaveBeenCalledTimes(1);
  });

  it("approve receipt=reverted → 抛 TierSaleApproveRevertedError，不进 buy", async () => {
    const deps = makeDeps({ waitForReceipt: vi.fn().mockResolvedValue(okReceipt("reverted")) });
    await expect(
      submitTierSaleBuy({ oddAmountWei: "1e18", usdtApproveWei: "1e18", nonce: "n" }, deps)
    ).rejects.toBeInstanceOf(TierSaleApproveRevertedError);
    expect(deps.buyTierSale).not.toHaveBeenCalled();
  });

  it("buy receipt=reverted → 抛 TierSaleBuyRevertedError", async () => {
    const deps = makeDeps({
      waitForReceipt: vi
        .fn()
        .mockResolvedValueOnce(okReceipt("success")) // approve ok
        .mockResolvedValueOnce(okReceipt("reverted")), // buy reverted
    });
    await expect(
      submitTierSaleBuy({ oddAmountWei: "1e18", usdtApproveWei: "1e18", nonce: "n" }, deps)
    ).rejects.toBeInstanceOf(TierSaleBuyRevertedError);
  });

  it("buy poll 超时 → ReceiptTimeoutError 透传（上层进对账态，禁止盲重发）", async () => {
    const deps = makeDeps({
      waitForReceipt: vi
        .fn()
        .mockResolvedValueOnce(okReceipt("success")) // approve ok
        .mockRejectedValueOnce(new ReceiptTimeoutError("0xbuy", 180000)), // buy timeout
    });
    await expect(
      submitTierSaleBuy({ oddAmountWei: "1e18", usdtApproveWei: "1e18", nonce: "n" }, deps)
    ).rejects.toBeInstanceOf(ReceiptTimeoutError);
  });
});

describe("isSlippageExceeded", () => {
  it("漂移在容差内 → false", () => {
    expect(isSlippageExceeded("100", "100.5", 100)).toBe(false); // 0.5% < 1%
    expect(isSlippageExceeded("100", "100", 100)).toBe(false);
  });
  it("漂移超容差（涨/跌双向）→ true", () => {
    expect(isSlippageExceeded("100", "102", 100)).toBe(true); // +2% > 1%
    expect(isSlippageExceeded("100", "98", 100)).toBe(true); // -2% > 1%
  });
  it("prev 为 0 / 空 → false（无基准）", () => {
    expect(isSlippageExceeded("0", "5", 100)).toBe(false);
    expect(isSlippageExceeded("", "5", 100)).toBe(false);
  });
});
