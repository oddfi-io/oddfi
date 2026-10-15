import { describe, it, expect, vi } from "vitest";
import { ensureBettingAllowance } from "./ensure-betting-allowance";
import { ApproveRevertedError } from "./submit-onchain-bet";
import type { OnchainTxRes } from "@/types/onchain-betting";
import type { WaitForReceiptResult } from "@/lib/onchain/receipt-poller";

const okReceipt: WaitForReceiptResult = {
  status: "success",
  blockNumber: 1n,
  txHash: "0xabc",
};

// 只有 tx_hash 影响 ensureBettingAllowance 逻辑；order_id/action_id/idempotency_key 用占位补全类型。
function makeDeps(txHash: string, receipt: WaitForReceiptResult = okReceipt) {
  const approveRes: OnchainTxRes = {
    order_id: 1,
    tx_hash: txHash,
    action_id: 1,
    idempotency_key: "k",
  };
  return {
    onchainApprove: vi.fn().mockResolvedValue(approveRes),
    waitForReceipt: vi.fn().mockResolvedValue(receipt),
  };
}

describe("ensureBettingAllowance", () => {
  it("approve 金额 = 总 stake × 1.01 ceiling（含税）", async () => {
    const deps = makeDeps("0xA1");
    await ensureBettingAllowance("100", deps);
    // 100e18 × 1.01 = 101e18
    expect(deps.onchainApprove).toHaveBeenCalledWith({
      target: "betting",
      amount_wei: "101000000000000000000",
    });
  });

  it("ceiling：非整除 stake 向上取整，allowance 不会 < stake×1.01", async () => {
    const deps = makeDeps("0xA1");
    // 1 wei × 1.01 = 1.01 → ceil 2（(1×101+99)/100 = 200/100 = 2）
    await ensureBettingAllowance("0.000000000000000001", deps);
    expect(deps.onchainApprove).toHaveBeenCalledWith({
      target: "betting",
      amount_wei: "2",
    });
  });

  it("真发 approve + 回执 success → 等回执后正常返回", async () => {
    const deps = makeDeps("0xDEAD");
    await expect(ensureBettingAllowance("50", deps)).resolves.toBeUndefined();
    expect(deps.waitForReceipt).toHaveBeenCalledWith("0xDEAD");
  });

  it("后端短路回落空 tx_hash → 视为已授权，跳过等回执", async () => {
    const deps = makeDeps("");
    await ensureBettingAllowance("50", deps);
    expect(deps.waitForReceipt).not.toHaveBeenCalled();
  });

  it("后端短路回落仅空白字符 tx_hash → 同样视为已授权，不等回执", async () => {
    const deps = makeDeps("   ");
    await ensureBettingAllowance("50", deps);
    expect(deps.waitForReceipt).not.toHaveBeenCalled();
  });

  it("回执 reverted → 抛 ApproveRevertedError（带 tx_hash）", async () => {
    const deps = makeDeps("0xBAD", { status: "reverted", blockNumber: 2n, txHash: "0xBAD" });
    await expect(ensureBettingAllowance("50", deps)).rejects.toBeInstanceOf(ApproveRevertedError);
  });

  it("onchainApprove 抛错（relay/网络）→ 透传，不吞", async () => {
    const deps = {
      onchainApprove: vi.fn().mockRejectedValue(new Error("relay 500")),
      waitForReceipt: vi.fn(),
    };
    await expect(ensureBettingAllowance("50", deps)).rejects.toThrow("relay 500");
    expect(deps.waitForReceipt).not.toHaveBeenCalled();
  });
});
