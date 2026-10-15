// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUnstakeTx } from "./useUnstakeTx";

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
  useTxLockStore: { getState: () => ({ lock: vi.fn(), unlock: vi.fn(), lockedBy: "unstake" }) },
}));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock("@/lib/onchain/tx-error", () => ({ toUserTxMessage: (e: Error) => e.message }));

const submitOnchainUnstakeMock = vi.fn();
vi.mock("@/lib/staking/submit-onchain-stake", () => ({
  submitOnchainUnstake: (...args: unknown[]) => submitOnchainUnstakeMock(...args),
}));

describe("useUnstakeTx — DD-147 地址门控", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContracts.mockReturnValue(STAKING_CONFIGURED);
  });

  it("stakingPool 地址 ZERO（未配置链）→ phase=failed，不调用 submit", () => {
    mockGetContracts.mockReturnValue({
      ...STAKING_CONFIGURED,
      stakingPool: "0x0000000000000000000000000000000000000000",
    });
    const { result } = renderHook(() => useUnstakeTx());

    act(() => {
      result.current.executeUnstake(1n);
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.errorMessage).toBe("Staking not available");
    expect(submitOnchainUnstakeMock).not.toHaveBeenCalled();
  });

  it("stakingPool 已配置（两网统一）→ 进入 submit", async () => {
    submitOnchainUnstakeMock.mockResolvedValueOnce({ txHash: "0xabc" });
    const { result } = renderHook(() => useUnstakeTx());

    act(() => {
      result.current.executeUnstake(1n);
    });

    await waitFor(() => expect(submitOnchainUnstakeMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.phase).toBe("success"));
  });
});
