import { describe, it, expect, vi } from "vitest";
import {
  submitOnchainDepositGlobal,
  submitOnchainDepositMatch,
  submitOnchainRequestUnbond,
  submitOnchainWithdrawLp,
  DepositRevertedError,
  UnbondRevertedError,
  WithdrawRevertedError,
  type OnchainDepositState,
} from "./submit-onchain-lp";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";

function mkDeps(receipt: "success" | "reverted" | "timeout" = "success") {
  const tx = "0xLP" as const;
  return {
    onchainDepositGlobal: vi.fn(async () => ({
      order_id: 1,
      tx_hash: tx,
      action_id: 1,
      idempotency_key: "lp-global-...",
    })),
    onchainDepositMatch: vi.fn(async () => ({
      order_id: 2,
      tx_hash: tx,
      action_id: 2,
      idempotency_key: "lp-match-...",
    })),
    onchainRequestUnbond: vi.fn(async () => ({
      order_id: 3,
      tx_hash: tx,
      action_id: 3,
      idempotency_key: "lp-unbond-...",
    })),
    onchainWithdrawLp: vi.fn(async () => ({
      order_id: 4,
      tx_hash: tx,
      action_id: 4,
      idempotency_key: "lp-withdraw-...",
    })),
    waitForReceipt: vi.fn(async (hash: `0x${string}`) => {
      if (receipt === "timeout") throw new ReceiptTimeoutError(hash, 1000);
      return { status: receipt, blockNumber: 1n, txHash: hash };
    }),
  } as const;
}

describe("submitOnchainDepositGlobal", () => {
  it("posts plan_id + amount_wei, emits 3 states", async () => {
    const deps = mkDeps();
    const states: OnchainDepositState[] = [];
    const res = await submitOnchainDepositGlobal(
      { planId: 0, stakeOdd: "1000", seq: "s1", onState: (s) => states.push(s) },
      deps
    );
    expect(res).toEqual({ txHash: "0xLP" });
    expect(states).toEqual(["depositing", "deposit_confirming", "success"]);
    // DD-141：idempotency_key → nonce = input.seq（"s1"）
    expect(deps.onchainDepositGlobal).toHaveBeenCalledWith({
      amount_wei: "1000000000000000000000",
      plan_id: 0,
      nonce: "s1",
    });
  });

  it("throws DepositRevertedError on revert", async () => {
    const deps = mkDeps("reverted");
    await expect(
      submitOnchainDepositGlobal({ planId: 0, stakeOdd: "1000", seq: "s1" }, deps)
    ).rejects.toBeInstanceOf(DepositRevertedError);
  });
});

describe("submitOnchainDepositMatch", () => {
  it("posts match_id + amount_wei", async () => {
    const deps = mkDeps();
    await submitOnchainDepositMatch({ matchId: "0xabc", stakeOdd: "1000", seq: "s1" }, deps);
    // DD-141：idempotency_key → nonce = input.seq（"s1"）
    expect(deps.onchainDepositMatch).toHaveBeenCalledWith({
      match_id: "0xabc",
      amount_wei: "1000000000000000000000",
      nonce: "s1",
    });
  });

  it("propagates ReceiptTimeoutError unwrapped", async () => {
    const deps = mkDeps("timeout");
    await expect(
      submitOnchainDepositMatch({ matchId: "0xabc", stakeOdd: "1000", seq: "s1" }, deps)
    ).rejects.toBeInstanceOf(ReceiptTimeoutError);
  });
});

describe("submitOnchainRequestUnbond / submitOnchainWithdrawLp", () => {
  it("request_unbond posts position_id only (DD-141: server derives key)", async () => {
    const deps = mkDeps();
    await submitOnchainRequestUnbond({ positionId: "65" }, deps);
    expect(deps.onchainRequestUnbond).toHaveBeenCalledWith({
      position_id: "65",
    });
  });

  it("withdraw posts position_id only (DD-141: server derives key)", async () => {
    const deps = mkDeps();
    await submitOnchainWithdrawLp({ positionId: "65" }, deps);
    expect(deps.onchainWithdrawLp).toHaveBeenCalledWith({
      position_id: "65",
    });
  });

  it("unbond throws UnbondRevertedError on revert", async () => {
    const deps = mkDeps("reverted");
    await expect(submitOnchainRequestUnbond({ positionId: "65" }, deps)).rejects.toBeInstanceOf(
      UnbondRevertedError
    );
  });

  it("withdraw throws WithdrawRevertedError on revert", async () => {
    const deps = mkDeps("reverted");
    await expect(submitOnchainWithdrawLp({ positionId: "65" }, deps)).rejects.toBeInstanceOf(
      WithdrawRevertedError
    );
  });
});
