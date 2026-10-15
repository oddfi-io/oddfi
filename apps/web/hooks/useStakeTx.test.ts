// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useStakeTx } from "./useStakeTx";
import type { LockHoursKey } from "@/lib/staking-plans";

// DD-149：execute 入参收紧为 branded LockHoursKey（透传 key 值，非展示天数）
const KEY24 = 24 as LockHoursKey;

// DD-147：execute 顶部门控由「IS_TESTNET」改为「stakingPool 地址是否配置」。

const STAKING_CONFIGURED = {
  pools: "0x0000000000000000000000000000000000000000",
  depositVault: "0x0000000000000000000000000000000000000000",
  oddToken: "0x0000000000000000000000000000000000000000",
  stakingPool: "0x837BEB9C2Cd6B45af68CD62009d874569584DDcA",
  lending: "0x0000000000000000000000000000000000000000",
  referral: "0x0000000000000000000000000000000000000000",
  usdc: "0x0000000000000000000000000000000000000000",
  usdt: "0x0000000000000000000000000000000000000000",
  bettingPool: "0x0000000000000000000000000000000000000000",
};
const mockGetContracts = vi.fn(() => STAKING_CONFIGURED);
vi.mock("@/lib/contracts", () => ({ getContracts: () => mockGetContracts() }));
vi.mock("@/lib/wagmi.config", () => ({ CORE_CHAIN: { id: 56 } }));

vi.mock("@/stores/txLockStore", () => ({
  useTxLockStore: { getState: () => ({ lock: vi.fn(), unlock: vi.fn(), lockedBy: "stake" }) },
}));
vi.mock("@/hooks/useIdempotentRefId", () => ({
  useIdempotentRefId: () => ({ getOrCreate: () => "ref-test", clear: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn() }));
vi.mock("@/lib/onchain/tx-error", () => ({ toUserTxMessage: (e: Error) => e.message }));

const submitOnchainStakeMock = vi.fn();
vi.mock("@/lib/staking/submit-onchain-stake", () => ({
  submitOnchainStake: (...args: unknown[]) => submitOnchainStakeMock(...args),
}));

describe("useStakeTx — DD-147 地址门控", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContracts.mockReturnValue(STAKING_CONFIGURED);
  });

  it("stakingPool 地址 ZERO（未配置链）→ phase=failed，不调用 submit", () => {
    mockGetContracts.mockReturnValue({
      ...STAKING_CONFIGURED,
      stakingPool: "0x0000000000000000000000000000000000000000",
    });
    const { result } = renderHook(() => useStakeTx());

    act(() => {
      result.current.execute("100", KEY24);
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.errorMessage).toBe("Staking not available on this network");
    expect(submitOnchainStakeMock).not.toHaveBeenCalled();
  });

  it("stakingPool 已配置（两网统一）→ 进入 submit", async () => {
    submitOnchainStakeMock.mockResolvedValueOnce({ txHash: "0xabc" });
    const { result } = renderHook(() => useStakeTx());

    act(() => {
      result.current.execute("100", KEY24);
    });

    await waitFor(() => expect(submitOnchainStakeMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.phase).toBe("success"));
  });
});
