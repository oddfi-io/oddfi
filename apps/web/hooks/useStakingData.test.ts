// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { parseUnits } from "viem";
import type { Address } from "viem";
import { useUserStaking, useStakingGlobalStats, useIsStakingAvailable } from "./useStakingData";

// ── Mock state captured by mock closures (mutate between tests) ─────────────
let mockEventQueryData: { created: unknown[]; withdrawn: unknown[] } | undefined;
const mockPositionsReturn: {
  data: unknown;
  isLoading: boolean;
  refetch: ReturnType<typeof vi.fn>;
} = { data: undefined, isLoading: false, refetch: vi.fn() };
const mockAccRewardReturn: {
  data: bigint | undefined;
  refetch: ReturnType<typeof vi.fn>;
} = { data: 0n, refetch: vi.fn() };

// Capture watcher handlers so tests can invoke them directly.
const capturedHandlers: Record<string, (logs: unknown[]) => void> = {};

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined }),
  usePublicClient: () => null,
  useReadContract: () => mockAccRewardReturn,
  useReadContracts: () => mockPositionsReturn,
  useWatchContractEvent: (cfg: { eventName: string; onLogs: (logs: unknown[]) => void }) => {
    capturedHandlers[cfg.eventName] = cfg.onLogs;
  },
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: false }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mockEventQueryData,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

// DD-147：useStakingData 已删 IS_TESTNET 业务闸，门控收敛到 getContracts 地址。
// 用可控 getContracts 覆盖「已配置 → 可用 / 地址 ZERO → 不可用」两态。
vi.mock("@/lib/wagmi.config", () => ({ CORE_CHAIN: { id: 97 } }));

const STAKING_CONFIGURED = {
  pools: "0x0000000000000000000000000000000000000001",
  depositVault: "0x0000000000000000000000000000000000000000",
  oddToken: "0x0000000000000000000000000000000000000002",
  stakingPool: "0x0000000000000000000000000000000000000003",
  lending: "0x0000000000000000000000000000000000000000",
  referral: "0x0000000000000000000000000000000000000000",
  usdc: "0x0000000000000000000000000000000000000000",
  usdt: "0x0000000000000000000000000000000000000000",
};
const mockGetContracts = vi.fn(() => STAKING_CONFIGURED);
vi.mock("@/lib/contracts", () => ({
  getContracts: () => mockGetContracts(),
}));

const USER = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF" as Address;
const OTHER = "0xCAFEbabeCAFEbabeCAFEbabeCAFEbabeCAFEbabe" as Address;

describe("useUserStaking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(capturedHandlers)) delete capturedHandlers[k];
    mockEventQueryData = { created: [], withdrawn: [] };
    mockPositionsReturn.data = undefined;
    mockPositionsReturn.isLoading = false;
    mockPositionsReturn.refetch = vi.fn();
    mockAccRewardReturn.data = 0n;
    mockAccRewardReturn.refetch = vi.fn();
  });

  it("returns empty active list when no address", () => {
    const { result } = renderHook(() => useUserStaking(undefined));
    expect(result.current.activePositions).toEqual([]);
    expect(result.current.historyRecords).toEqual([]);
    expect(typeof result.current.refetch).toBe("function");
  });

  it("assembles active positions from positionsData and excludes withdrawn", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    mockEventQueryData = {
      created: [{ args: { positionId: 1n, planId: 2 } }, { args: { positionId: 2n, planId: 0 } }],
      withdrawn: [],
    };
    // Position 1: active=true, unlockAt future → status=active
    // Position 2: active=false → filtered (withdrawn)
    mockPositionsReturn.data = [
      {
        status: "success",
        result: {
          owner: USER,
          principal: parseUnits("100", 18),
          weight: 1000n,
          unlockAt: BigInt(nowSec + 3600),
          rewardDebt: 0n,
          planId: 2,
          sourceType: 0,
          active: true,
        },
      },
      {
        status: "success",
        result: {
          owner: USER,
          principal: parseUnits("50", 18),
          weight: 500n,
          unlockAt: BigInt(nowSec - 1000),
          rewardDebt: 0n,
          planId: 0,
          sourceType: 0,
          active: false, // withdrawn → filtered
        },
      },
    ];

    const { result } = renderHook(() => useUserStaking(USER));

    await waitFor(() => {
      expect(result.current.activePositions).toHaveLength(1);
    });
    expect(result.current.activePositions[0].id).toBe("1");
    expect(result.current.activePositions[0].status).toBe("active");
  });

  it("StakeCreated handler is case-insensitive (checksummed vs lowercase)", async () => {
    renderHook(() => useUserStaking(USER));
    await waitFor(() => expect(capturedHandlers.StakeCreated).toBeDefined());

    act(() => {
      // checksummed USER vs all-lowercase log.args.user — must still match
      capturedHandlers.StakeCreated([{ args: { user: USER.toLowerCase(), positionId: 11n } }]);
    });
    expect(mockPositionsReturn.refetch).toHaveBeenCalled();
  });

  it("StakeCreated handler ignores logs from other users (owner filter)", async () => {
    const { result } = renderHook(() => useUserStaking(USER));
    // capture watcher
    await waitFor(() => expect(capturedHandlers.StakeCreated).toBeDefined());

    const before = result.current.activePositions.length;
    act(() => {
      capturedHandlers.StakeCreated([{ args: { user: OTHER, positionId: 999n } }]);
    });
    expect(result.current.activePositions.length).toBe(before);
    expect(mockPositionsReturn.refetch).not.toHaveBeenCalled();
  });

  it("StakeWithdrawn handler for the current user triggers refetch on positions + accReward", async () => {
    renderHook(() => useUserStaking(USER));
    await waitFor(() => expect(capturedHandlers.StakeWithdrawn).toBeDefined());

    act(() => {
      capturedHandlers.StakeWithdrawn([{ args: { user: USER } }]);
    });

    expect(mockPositionsReturn.refetch).toHaveBeenCalled();
    expect(mockAccRewardReturn.refetch).toHaveBeenCalled();
  });

  it("RewardNotified handler refetches accRewardPerShare (broadcast event, no user filter)", async () => {
    renderHook(() => useUserStaking(USER));
    await waitFor(() => expect(capturedHandlers.RewardNotified).toBeDefined());

    act(() => {
      capturedHandlers.RewardNotified([
        { args: { caller: OTHER, amount: 1n, newAccRewardPerShare: 100n } },
      ]);
    });

    expect(mockAccRewardReturn.refetch).toHaveBeenCalled();
  });

  it("derives history with `early` flag from StakeWithdrawn events", async () => {
    mockEventQueryData = {
      created: [{ args: { positionId: 5n, planId: 1 } }],
      withdrawn: [
        {
          log: {
            args: {
              positionId: 5n,
              user: USER,
              principal: parseUnits("100", 18),
              reward: parseUnits("3", 18),
              early: true,
            },
          },
          blockTimestamp: 1_700_000_000,
        },
      ],
    };
    mockPositionsReturn.data = [];

    const { result } = renderHook(() => useUserStaking(USER));
    await waitFor(() => expect(result.current.historyRecords).toHaveLength(1));
    expect(result.current.historyRecords[0].action).toBe("early_unstake");
  });
});

describe("useStakingGlobalStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // data 设为 undefined → totalStaked undefined（避免 BigInt(undefined) 抛错），只验 refetch 形状
    mockEventQueryData = undefined;
  });

  // BUG-023：写操作成功后需主动刷新全局 Total Staked，故 hook 必须透出 refetch
  it("exposes a callable refetch", () => {
    const { result } = renderHook(() => useStakingGlobalStats());
    expect(typeof result.current.refetch).toBe("function");
  });
});

// DD-147：可用性门控收敛到合约地址（不再看 IS_TESTNET）
describe("useIsStakingAvailable", () => {
  beforeEach(() => {
    mockGetContracts.mockReset();
    mockGetContracts.mockReturnValue(STAKING_CONFIGURED);
  });

  it("stakingPool + oddToken 已配置 → 可用（true，两网统一）", () => {
    const { result } = renderHook(() => useIsStakingAvailable());
    expect(result.current).toBe(true);
  });

  it("stakingPool 地址为 ZERO（未配置链）→ 不可用（false）", () => {
    mockGetContracts.mockReturnValue({
      ...STAKING_CONFIGURED,
      stakingPool: "0x0000000000000000000000000000000000000000",
    });
    const { result } = renderHook(() => useIsStakingAvailable());
    expect(result.current).toBe(false);
  });
});
