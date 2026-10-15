import { describe, it, expect, vi } from "vitest";
import {
  submitOnchainStake,
  submitOnchainUnstake,
  StakeRevertedError,
  UnstakeRevertedError,
  type OnchainStakeState,
  type OnchainUnstakeState,
} from "./submit-onchain-stake";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";
import type { LockHoursKey } from "@/lib/staking-plans";

// DD-149：execute/submitOnchainStake 入参 lockHours 收紧为 branded LockHoursKey；测试用透传 key 值
const KEY8 = 8 as LockHoursKey;
const KEY24 = 24 as LockHoursKey;

function mkDeps(
  overrides: {
    stakeTx?: string;
    stakeReceipt?: "success" | "reverted" | "timeout";
    unstakeTx?: string;
    unstakeReceipt?: "success" | "reverted" | "timeout";
  } = {}
) {
  return {
    onchainStake: vi.fn(async () => ({
      order_id: 1,
      tx_hash: overrides.stakeTx ?? "0xSTAKE",
      action_id: 1,
      idempotency_key: "stake-...",
    })),
    onchainUnstake: vi.fn(async () => ({
      order_id: 2,
      tx_hash: overrides.unstakeTx ?? "0xUNSTAKE",
      action_id: 2,
      idempotency_key: "unstake-...",
    })),
    onchainEarlyUnstake: vi.fn(async () => ({
      order_id: 3,
      tx_hash: overrides.unstakeTx ?? "0xEARLY",
      action_id: 3,
      idempotency_key: "early-unstake-...",
    })),
    waitForReceipt: vi.fn(async (hash: `0x${string}`) => {
      const which =
        hash === (overrides.stakeTx ?? "0xSTAKE")
          ? overrides.stakeReceipt
          : overrides.unstakeReceipt;
      if (which === "timeout") throw new ReceiptTimeoutError(hash, 1000);
      return { status: which ?? "success", blockNumber: 1n, txHash: hash };
    }),
  } as const;
}

describe("submitOnchainStake — happy path", () => {
  it("posts amount_wei + lock_hours (no approve step), emits 3 states", async () => {
    const deps = mkDeps();
    const states: OnchainStakeState[] = [];
    const res = await submitOnchainStake(
      { lockHours: KEY8, stakeOdd: "100", seq: "s1", onState: (s) => states.push(s) },
      deps
    );

    expect(res).toEqual({ txHash: "0xSTAKE" });
    expect(states).toEqual(["staking", "stake_confirming", "success"]);
    // DD-141：idempotency_key → nonce = input.seq（"s1"）
    expect(deps.onchainStake).toHaveBeenCalledWith({
      amount_wei: "100000000000000000000",
      lock_hours: 8,
      nonce: "s1",
    });
  });

  it("supports decimal stake amounts (100.5 ODD)", async () => {
    const deps = mkDeps();
    await submitOnchainStake({ lockHours: KEY24, stakeOdd: "100.5", seq: "s1" }, deps);
    expect(deps.onchainStake).toHaveBeenCalledWith(
      expect.objectContaining({ amount_wei: "100500000000000000000", lock_hours: 24 })
    );
  });
});

describe("submitOnchainStake — failures", () => {
  it("throws StakeRevertedError when receipt reverted", async () => {
    const deps = mkDeps({ stakeReceipt: "reverted" });
    await expect(
      submitOnchainStake({ lockHours: KEY8, stakeOdd: "100", seq: "s1" }, deps)
    ).rejects.toBeInstanceOf(StakeRevertedError);
  });

  it("propagates ReceiptTimeoutError unwrapped", async () => {
    const deps = mkDeps({ stakeReceipt: "timeout" });
    await expect(
      submitOnchainStake({ lockHours: KEY8, stakeOdd: "100", seq: "s1" }, deps)
    ).rejects.toBeInstanceOf(ReceiptTimeoutError);
  });

  it("emits states up to failure point", async () => {
    const deps = mkDeps({ stakeReceipt: "reverted" });
    const states: OnchainStakeState[] = [];
    await expect(
      submitOnchainStake(
        { lockHours: KEY8, stakeOdd: "100", seq: "s1", onState: (s) => states.push(s) },
        deps
      )
    ).rejects.toThrow();
    expect(states).toEqual(["staking", "stake_confirming"]);
  });
});

describe("submitOnchainUnstake", () => {
  it("calls onchainUnstake for op=unstake with position_id only (DD-141: server derives key)", async () => {
    const deps = mkDeps();
    const states: OnchainUnstakeState[] = [];
    const res = await submitOnchainUnstake(
      { positionId: "12", op: "unstake", onState: (s) => states.push(s) },
      deps
    );
    expect(res).toEqual({ txHash: "0xUNSTAKE" });
    expect(states).toEqual(["unstaking", "unstake_confirming", "success"]);
    expect(deps.onchainUnstake).toHaveBeenCalledWith({
      position_id: "12",
    });
    expect(deps.onchainEarlyUnstake).not.toHaveBeenCalled();
  });

  it("calls onchainEarlyUnstake for op=earlyUnstake with position_id only", async () => {
    const deps = mkDeps();
    await submitOnchainUnstake({ positionId: "12", op: "earlyUnstake" }, deps);
    expect(deps.onchainEarlyUnstake).toHaveBeenCalledWith({
      position_id: "12",
    });
    expect(deps.onchainUnstake).not.toHaveBeenCalled();
  });

  it("throws UnstakeRevertedError (carries op) when receipt reverted", async () => {
    const deps = mkDeps({ unstakeReceipt: "reverted" });
    await expect(
      submitOnchainUnstake({ positionId: "12", op: "unstake" }, deps)
    ).rejects.toBeInstanceOf(UnstakeRevertedError);
  });
});
