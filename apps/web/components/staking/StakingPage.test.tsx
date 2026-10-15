// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import StakingPage from "./StakingPage";

// BUG-023 回归：质押 / 解押成功后，仓位列表（useStakeHistory.refetch）与全局
// Total Staked（useStakingGlobalStats.refetch）是两个独立 hook，写操作成功必须一起刷新。
// StakingPage 把两者合并成 refetchAll 传给 useStakeTx / useUnstakeTx 的 onSuccess。
// 这里 mock 四个 hook，捕获传入的 onSuccess，断言它确实触发两个 refetch。

const h = vi.hoisted(() => ({
  refetchStats: vi.fn(),
  refetchPositions: vi.fn(),
  stakeOnSuccess: undefined as undefined | (() => void),
  unstakeOnSuccess: undefined as undefined | (() => void),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: true, address: undefined }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/toast", () => ({ showToast: vi.fn() }));
vi.mock("@/lib/platform-token", () => ({ PLATFORM_TOKEN_DISPLAY: "ODD" }));

vi.mock("@/hooks/useStakingData", () => ({
  useIsStakingAvailable: () => true,
  useStakingGlobalStats: () => ({
    totalStaked: "1000",
    minStakeAmount: "100",
    isLoading: false,
    refetch: h.refetchStats,
  }),
}));

vi.mock("@/hooks/useStakeHistory", () => ({
  useStakeHistory: () => ({
    activePositions: [],
    historyRecords: [],
    isLoading: false,
    refetch: h.refetchPositions,
  }),
}));

vi.mock("@/hooks/useAccountBalance", () => ({
  useAccountBalance: () => ({ data: { available_balance: "500" }, isLoading: false }),
}));

vi.mock("@/hooks/useStakeTx", () => ({
  useStakeTx: (onSuccess: () => void) => {
    h.stakeOnSuccess = onSuccess;
    return { phase: "idle", execute: vi.fn(), reset: vi.fn() };
  },
}));

vi.mock("@/hooks/useUnstakeTx", () => ({
  useUnstakeTx: (onSuccess: () => void) => {
    h.unstakeOnSuccess = onSuccess;
    return {
      phase: "idle",
      executeUnstake: vi.fn(),
      executeEarlyUnstake: vi.fn(),
      lastPositionId: undefined,
      reset: vi.fn(),
    };
  },
}));

// 子组件用桩，避免拉入 StakeTab / UnstakeTab 的重依赖
vi.mock("./StakeTab", () => ({ default: () => null }));
vi.mock("./UnstakeTab", () => ({ default: () => null }));

describe("StakingPage — BUG-023 写操作后双刷新", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.stakeOnSuccess = undefined;
    h.unstakeOnSuccess = undefined;
  });

  it("把同一个 refetchAll 传给 stake 与 unstake 的 onSuccess", () => {
    render(<StakingPage />);
    expect(typeof h.stakeOnSuccess).toBe("function");
    expect(typeof h.unstakeOnSuccess).toBe("function");
    expect(h.stakeOnSuccess).toBe(h.unstakeOnSuccess);
  });

  it("解押成功回调同时刷新仓位列表 + 全局 Total Staked", () => {
    render(<StakingPage />);
    act(() => h.unstakeOnSuccess?.());
    expect(h.refetchPositions).toHaveBeenCalledTimes(1);
    expect(h.refetchStats).toHaveBeenCalledTimes(1);
  });

  it("质押成功回调同时刷新仓位列表 + 全局 Total Staked", () => {
    render(<StakingPage />);
    act(() => h.stakeOnSuccess?.());
    expect(h.refetchPositions).toHaveBeenCalledTimes(1);
    expect(h.refetchStats).toHaveBeenCalledTimes(1);
  });

  it("仅渲染（无 tx 成功）不会触发任何刷新——刷新只走 success 路径", () => {
    render(<StakingPage />);
    expect(h.refetchPositions).not.toHaveBeenCalled();
    expect(h.refetchStats).not.toHaveBeenCalled();
  });
});
