// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDepositMatchTx } from "./useDepositMatchTx";

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

vi.mock("@/hooks/useIdempotentRefId", () => ({
  useIdempotentRefId: () => ({ getOrCreate: () => "ref-test", clear: vi.fn() }),
}));
vi.mock("@/stores/lpRefetchStore", () => ({
  useLpRefetchStore: (selector: (s: { bump: () => void; startSync: () => void }) => unknown) =>
    selector({ bump: vi.fn(), startSync: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));
vi.mock("@/lib/onchain/tx-error", () => ({ toUserTxMessage: (e: Error) => e.message }));

const submitOnchainDepositMatchMock = vi.fn();
vi.mock("@/lib/liquidity/submit-onchain-lp", () => ({
  submitOnchainDepositMatch: (...args: unknown[]) => submitOnchainDepositMatchMock(...args),
}));

// execute(amount, matchId, isPaused, minDeposit, balanceOf)
const MATCH_ID = "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
const VALID_ARGS = ["100", MATCH_ID, false, 100n * 10n ** 18n, 10_000n * 10n ** 18n] as const;

describe("useDepositMatchTx — DD-147 地址门控", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContracts.mockReturnValue(POOLS_CONFIGURED);
  });

  it("pools 地址 ZERO（未配置链）→ phase=failed，不调用 submit", async () => {
    mockGetContracts.mockReturnValue({
      ...POOLS_CONFIGURED,
      pools: "0x0000000000000000000000000000000000000000",
    });
    const { result } = renderHook(() => useDepositMatchTx());

    await act(async () => {
      await result.current.execute(...VALID_ARGS);
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.errorMessage).toBe("Liquidity pool not available on this network");
    expect(submitOnchainDepositMatchMock).not.toHaveBeenCalled();
  });

  it("pools 已配置（两网统一）+ 合法参数 → 进入 submit", async () => {
    submitOnchainDepositMatchMock.mockResolvedValueOnce({ txHash: "0xabc" });
    const { result } = renderHook(() => useDepositMatchTx());

    await act(async () => {
      await result.current.execute(...VALID_ARGS);
    });

    expect(submitOnchainDepositMatchMock).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("success");
  });
});
