import { describe, it, expect, vi } from "vitest";
import {
  submitOnchainBet,
  ApproveRevertedError,
  BetRevertedError,
  type OnchainBetState,
} from "./submit-onchain-bet";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";

const baseInput = {
  fixtureId: 19683241,
  matchId: "0xf1bc",
  marketType: 0,
  outcome: 0,
  line: 0,
  stakeOdd: "100",
  decimalOdds: "1.85",
  seq: "abc",
};

function mkDeps(
  overrides: {
    approveTx?: string;
    approveReceipt?: "success" | "reverted" | "timeout";
    betTx?: string;
    betReceipt?: "success" | "reverted" | "timeout";
  } = {}
) {
  return {
    onchainApprove: vi.fn(async () => ({
      order_id: 1,
      tx_hash: overrides.approveTx ?? "0xAAA",
      action_id: 1,
      // DD-141：响应体的 idempotency_key 是后端派生值，前端只读不回传（此处仅 mock 占位）
      idempotency_key: "server-derived-approve",
    })),
    onchainPlaceBet: vi.fn(async () => ({
      order_id: 2,
      tx_hash: overrides.betTx ?? "0xBBB",
      action_id: 2,
      idempotency_key: "server-derived-placebet",
    })),
    waitForReceipt: vi.fn(async (hash: `0x${string}`) => {
      const which =
        hash === (overrides.approveTx ?? "0xAAA") ? overrides.approveReceipt : overrides.betReceipt;
      if (which === "timeout") throw new ReceiptTimeoutError(hash, 1000);
      return { status: which ?? "success", blockNumber: 1n, txHash: hash };
    }),
  } as const;
}

describe("submitOnchainBet — happy path", () => {
  it("approves with stake×1.01, places bet with approve tx_hash, emits all 5 states", async () => {
    const deps = mkDeps();
    const states: OnchainBetState[] = [];
    const res = await submitOnchainBet({ ...baseInput, onState: (s) => states.push(s) }, deps);

    expect(res).toEqual({ approveTxHash: "0xAAA", betTxHash: "0xBBB", orderId: 2 });
    expect(states).toEqual([
      "approving",
      "approve_confirming",
      "betting",
      "bet_confirming",
      "success",
    ]);
    // approve amount_wei = 100 * 1.01 * 1e18 = 101e18
    // DD-141：approve 不再传 idempotency_key（后端派生）
    expect(deps.onchainApprove).toHaveBeenCalledWith({
      target: "betting",
      amount_wei: "101000000000000000000",
    });
    // DD-141 回归护栏：approve 请求体必须不含 idempotency_key（防未来误加回字段）
    expect(deps.onchainApprove).not.toHaveBeenCalledWith(
      expect.objectContaining({ idempotency_key: expect.anything() })
    );
    // place_bet uses stake wei (no tax) and 1.85 → 18500 basis points
    // DD-141：idempotency_key → nonce = input.seq（"abc"）
    expect(deps.onchainPlaceBet).toHaveBeenCalledWith({
      match_id: "0xf1bc",
      market_type: 0,
      line: 0,
      outcome: 0,
      amount_wei: "100000000000000000000",
      min_accepted_amount_wei: "100000000000000000000",
      min_odds: "18500",
      approve_tx_hash: "0xAAA",
      nonce: "abc",
    });
  });

  it("supports decimal stake amounts (100.5 ODD)", async () => {
    const deps = mkDeps();
    await submitOnchainBet({ ...baseInput, stakeOdd: "100.5" }, deps);
    // 100.5 * 1.01 * 1e18 = 101.505e18 → 101505000000000000000
    expect(deps.onchainApprove).toHaveBeenCalledWith(
      expect.objectContaining({ amount_wei: "101505000000000000000" })
    );
    expect(deps.onchainPlaceBet).toHaveBeenCalledWith(
      expect.objectContaining({ amount_wei: "100500000000000000000" })
    );
  });

  it("DD-119 P2: minAcceptedWeiOverride 覆盖 min_accepted（部分成交允许）", async () => {
    const deps = mkDeps();
    await submitOnchainBet({ ...baseInput, minAcceptedWeiOverride: "60000000000000000000" }, deps);
    // amount 仍全额，min_accepted 降为 acceptedAmount → 合约可部分成交并退回剩余
    expect(deps.onchainPlaceBet).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_wei: "100000000000000000000",
        min_accepted_amount_wei: "60000000000000000000",
      })
    );
  });

  it("DD-140: deferReceipt 模式 place_bet 200 即返回 orderId，不等 bet receipt", async () => {
    const deps = mkDeps();
    const states: OnchainBetState[] = [];
    const res = await submitOnchainBet(
      { ...baseInput, deferReceipt: true, onState: (s) => states.push(s) },
      deps
    );
    expect(res).toEqual({ approveTxHash: "0xAAA", betTxHash: "0xBBB", orderId: 2 });
    // place_bet 已提交，但 bet receipt 未等：waitForReceipt 仅为 approve 调用 1 次，无 bet_confirming/success
    expect(deps.waitForReceipt).toHaveBeenCalledTimes(1);
    expect(states).toEqual(["approving", "approve_confirming", "betting"]);
  });

  it("DD-140: deferReceipt 模式即使 place_bet receipt 会 revert 也不抛（交后台跟踪）", async () => {
    const deps = mkDeps({ betReceipt: "reverted" });
    await expect(
      submitOnchainBet({ ...baseInput, deferReceipt: true }, deps)
    ).resolves.toMatchObject({ orderId: 2 });
  });
});

describe("submitOnchainBet — failure modes", () => {
  it("throws ApproveRevertedError when approve receipt reverted", async () => {
    const deps = mkDeps({ approveReceipt: "reverted" });
    await expect(submitOnchainBet(baseInput, deps)).rejects.toBeInstanceOf(ApproveRevertedError);
    expect(deps.onchainPlaceBet).not.toHaveBeenCalled();
  });

  it("throws BetRevertedError when place_bet receipt reverted", async () => {
    const deps = mkDeps({ betReceipt: "reverted" });
    await expect(submitOnchainBet(baseInput, deps)).rejects.toBeInstanceOf(BetRevertedError);
  });

  it("propagates ReceiptTimeoutError without wrapping (let UI map to friendly toast)", async () => {
    const deps = mkDeps({ approveReceipt: "timeout" });
    await expect(submitOnchainBet(baseInput, deps)).rejects.toBeInstanceOf(ReceiptTimeoutError);
  });

  it("emits state up to the failure point", async () => {
    const deps = mkDeps({ approveReceipt: "reverted" });
    const states: OnchainBetState[] = [];
    await expect(
      submitOnchainBet({ ...baseInput, onState: (s) => states.push(s) }, deps)
    ).rejects.toThrow();
    expect(states).toEqual(["approving", "approve_confirming"]);
  });
});

describe("submitOnchainBet — odds basis-point conversion", () => {
  it("converts 1.01 → 10100", async () => {
    const deps = mkDeps();
    await submitOnchainBet({ ...baseInput, decimalOdds: "1.01" }, deps);
    expect(deps.onchainPlaceBet).toHaveBeenCalledWith(
      expect.objectContaining({ min_odds: "10100" })
    );
  });

  it("floors fractional basis points (2.336 → 23360)", async () => {
    const deps = mkDeps();
    await submitOnchainBet({ ...baseInput, decimalOdds: "2.336" }, deps);
    expect(deps.onchainPlaceBet).toHaveBeenCalledWith(
      expect.objectContaining({ min_odds: "23360" })
    );
  });

  it("DD-117: minOddsBpsOverride 优先于 decimalOdds 派生", async () => {
    const deps = mkDeps();
    await submitOnchainBet(
      { ...baseInput, decimalOdds: "1.85", minOddsBpsOverride: "29700" },
      deps
    );
    expect(deps.onchainPlaceBet).toHaveBeenCalledWith(
      expect.objectContaining({ min_odds: "29700" })
    );
  });
});
