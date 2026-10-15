// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDepositGlobalTx } from "./useDepositGlobalTx";

// DD-147：execute 顶部门控由「IS_TESTNET」改为「pools 地址是否配置」。
// 本测试锁定新门控：pools ZERO（未配置链）→ 拦截不提交；pools 配置 → 正常进入 submit。

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
vi.mock("@/lib/contracts", () => ({
  getContracts: () => mockGetContracts(),
}));

vi.mock("@/lib/wagmi.config", () => ({ CORE_CHAIN: { id: 56 } }));

vi.mock("@/hooks/useIdempotentRefId", () => ({
  useIdempotentRefId: () => ({ getOrCreate: () => "ref-test", clear: vi.fn() }),
}));

vi.mock("@/stores/lpRefetchStore", () => ({
  useLpRefetchStore: (selector: (s: { bump: () => void; startSync: () => void }) => unknown) =>
    selector({ bump: vi.fn(), startSync: vi.fn() }),
}));

vi.mock("@/lib/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/onchain/tx-error", () => ({
  toUserTxMessage: (e: Error) => e.message,
}));

const submitOnchainDepositGlobalMock = vi.fn();
vi.mock("@/lib/liquidity/submit-onchain-lp", () => ({
  submitOnchainDepositGlobal: (...args: unknown[]) => submitOnchainDepositGlobalMock(...args),
}));

// execute(amount, planId, isPaused, minDeposit, balanceOf)
const VALID_ARGS = ["100", 0, false, 100n * 10n ** 18n, 10_000n * 10n ** 18n] as const;

describe("useDepositGlobalTx — DD-147 地址门控", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContracts.mockReturnValue(POOLS_CONFIGURED);
  });

  it("pools 地址 ZERO（未配置链）→ phase=failed，不调用 submit", async () => {
    mockGetContracts.mockReturnValue({
      ...POOLS_CONFIGURED,
      pools: "0x0000000000000000000000000000000000000000",
    });
    const { result } = renderHook(() => useDepositGlobalTx());

    await act(async () => {
      await result.current.execute(...VALID_ARGS);
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.errorMessage).toBe("Liquidity pool not available on this network");
    expect(submitOnchainDepositGlobalMock).not.toHaveBeenCalled();
  });

  it("pools 已配置（两网统一）+ 合法参数 → 进入 submit", async () => {
    submitOnchainDepositGlobalMock.mockResolvedValueOnce({ txHash: "0xabc" });
    const { result } = renderHook(() => useDepositGlobalTx());

    await act(async () => {
      await result.current.execute(...VALID_ARGS);
    });

    expect(submitOnchainDepositGlobalMock).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("success");
  });
});
