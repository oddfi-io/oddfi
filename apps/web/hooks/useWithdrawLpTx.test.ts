// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWithdrawLpTx } from "./useWithdrawLpTx";

// DD-147：execute 顶部门控由「IS_TESTNET」改为「pools 地址是否配置」。

const POOLS_CONFIGURED = {
  pools: "0x55419B1529b89FE3C72BdC3062515f431a63F06A",
  depositVault: "0x0000000000000000000000000000000000000000",
  oddToken: "0x0000000000000000000000000000000000000000",
  stakingPool: "0x0000000000000000000000000000000000000000",
  lending: "0x0000000000000000000000000000000000000000",
  referral: "0x0000000000000000000000000000000000000000",
  usdc: "0x0000000000000000000000000000000000000000",
  usdt: "0x0000000000000000000000000000000000000000",
  bettingPool: "0x0000000000000000000000000000000000000000",
};
const mockGetContracts = vi.fn(() => POOLS_CONFIGURED);
vi.mock("@/lib/contracts", () => ({ getContracts: () => mockGetContracts() }));
vi.mock("@/lib/wagmi.config", () => ({ CORE_CHAIN: { id: 56 } }));

vi.mock("@/lib/abi/liquidityPool", () => ({
  LP_POSITION_STATE: { Pending: 0, Bonded: 1, Ready: 2, Unbonding: 3, Withdrawable: 4 },
}));
vi.mock("@/stores/lpRefetchStore", () => ({
  useLpRefetchStore: (selector: (s: { bump: () => void }) => unknown) =>
    selector({ bump: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn() }));
vi.mock("@/lib/onchain/tx-error", () => ({ toUserTxMessage: (e: Error) => e.message }));

const submitOnchainWithdrawLpMock = vi.fn();
vi.mock("@/lib/liquidity/submit-onchain-lp", () => ({
  submitOnchainWithdrawLp: (...args: unknown[]) => submitOnchainWithdrawLpMock(...args),
}));

const WITHDRAWABLE = 4; // 对应 mock 的 LP_POSITION_STATE.Withdrawable

describe("useWithdrawLpTx — DD-147 地址门控", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContracts.mockReturnValue(POOLS_CONFIGURED);
  });

  it("pools 地址 ZERO（未配置链）→ phase=failed，不调用 submit", () => {
    mockGetContracts.mockReturnValue({
      ...POOLS_CONFIGURED,
      pools: "0x0000000000000000000000000000000000000000",
    });
    const { result } = renderHook(() => useWithdrawLpTx());

    act(() => {
      result.current.execute(1n, WITHDRAWABLE, false);
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.errorMessage).toBe("Liquidity pool not available on this network");
    expect(submitOnchainWithdrawLpMock).not.toHaveBeenCalled();
  });

  it("pools 已配置（两网统一）+ Withdrawable 态 + 未暂停 → 进入 submit", async () => {
    submitOnchainWithdrawLpMock.mockResolvedValueOnce({ txHash: "0xabc" });
    const { result } = renderHook(() => useWithdrawLpTx());

    act(() => {
      result.current.execute(1n, WITHDRAWABLE, false);
    });

    await waitFor(() => expect(submitOnchainWithdrawLpMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.phase).toBe("success"));
  });
});
