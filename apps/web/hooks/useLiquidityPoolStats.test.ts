// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLiquidityPoolStats } from "./useLiquidityPoolStats";

// ── Mocks ─────────────────────────────────────────────────────────

// Mutable object captured by the mock closure — mutate before each renderHook call.
const mockReadContractsReturn: { data: unknown; isFetching: boolean; refetch: () => void } = {
  data: undefined,
  isFetching: false,
  refetch: vi.fn(),
};

vi.mock("wagmi", () => ({
  useReadContracts: () => mockReadContractsReturn,
}));

// Stub zustand store so useEffect doesn't crash
vi.mock("@/stores/lpRefetchStore", () => ({
  useLpRefetchStore: (selector: (s: { bumpKey: number }) => unknown) => selector({ bumpKey: 0 }),
}));

// DD-147：useLiquidityPoolStats 已删 IS_TESTNET 业务闸，门控只看 getContracts().pools 是否 ZERO。
// 下方可控 mockGetContracts 已覆盖 pools 非零（happy）/ ZERO（FALLBACK）两态。
vi.mock("@/lib/wagmi.config", () => ({
  CORE_CHAIN: { id: 97 }, // bscTestnet chainId
}));

vi.mock("@/lib/abi/liquidityPool", () => ({
  LIQUIDITY_POOL_ABI: [],
}));

const NON_ZERO_POOLS_ADDR = "0xc2c8F0Ba173a579f577e8aFc01b89A724a5Fcba9";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

function makeContractAddresses(pools: string) {
  return {
    pools,
    depositVault: ZERO_ADDR,
    oddToken: ZERO_ADDR,
    stakingPool: ZERO_ADDR,
    lending: ZERO_ADDR,
    referral: ZERO_ADDR,
    usdc: ZERO_ADDR,
    usdt: ZERO_ADDR,
  };
}

// Controllable getContracts — default returns the real testnet pools address.
// Typed with an explicit parameter so mockReturnValueOnce overrides type-check cleanly.
const mockGetContracts = vi.fn(() => makeContractAddresses(NON_ZERO_POOLS_ADDR));

vi.mock("@/lib/contracts", () => ({
  getContracts: () => mockGetContracts(),
}));

// ── Helpers ───────────────────────────────────────────────────────

function makeResult<T>(status: "success" | "failure", result?: T) {
  return status === "success" ? { status, result } : { status, error: new Error("revert") };
}

// ── Tests ─────────────────────────────────────────────────────────

describe("useLiquidityPoolStats", () => {
  beforeEach(() => {
    mockReadContractsReturn.data = undefined;
    mockReadContractsReturn.isFetching = false;
    mockGetContracts.mockClear();
    // Restore default (non-zero pools address) before each test.
    mockGetContracts.mockImplementation(() => ({
      pools: "0xc2c8F0Ba173a579f577e8aFc01b89A724a5Fcba9",
      depositVault: "0x0000000000000000000000000000000000000000",
      oddToken: "0x0000000000000000000000000000000000000000",
      stakingPool: "0x0000000000000000000000000000000000000000",
      lending: "0x0000000000000000000000000000000000000000",
      referral: "0x0000000000000000000000000000000000000000",
      usdc: "0x0000000000000000000000000000000000000000",
      usdt: "0x0000000000000000000000000000000000000000",
    }));
  });

  it("passes isLoading=true through when contracts are still fetching", () => {
    mockReadContractsReturn.data = undefined;
    mockReadContractsReturn.isFetching = true;

    const { result } = renderHook(() => useLiquidityPoolStats());

    expect(result.current.isLoading).toBe(true);
    // Values not yet available — return zero fallbacks while loading.
    expect(result.current.totalActiveDeposited).toBe(0n);
    expect(result.current.minDeposit).toBe(0n);
    expect(result.current.isPaused).toBe(false);
  });

  it("assembles stats from successful contract results (happy path)", () => {
    const totalActiveDeposited = 500_000n * 10n ** 18n;
    const minDeposit = 100n * 10n ** 18n;

    mockReadContractsReturn.data = [
      makeResult("success", totalActiveDeposited),
      makeResult("success", minDeposit),
      makeResult("success", false),
    ];
    mockReadContractsReturn.isFetching = false;

    const { result } = renderHook(() => useLiquidityPoolStats());

    expect(result.current.totalActiveDeposited).toBe(totalActiveDeposited);
    expect(result.current.minDeposit).toBe(minDeposit);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns isPaused=true when contract reports paused", () => {
    mockReadContractsReturn.data = [
      makeResult("success", 250_000n * 10n ** 18n),
      makeResult("success", 50n * 10n ** 18n),
      makeResult("success", true), // paused = true
    ];
    mockReadContractsReturn.isFetching = false;

    const { result } = renderHook(() => useLiquidityPoolStats());

    expect(result.current.isPaused).toBe(true);
  });

  it("falls back to 0n/0n/false when all results have status=failure (revert)", () => {
    mockReadContractsReturn.data = [
      makeResult("failure"),
      makeResult("failure"),
      makeResult("failure"),
    ];
    mockReadContractsReturn.isFetching = false;

    const { result } = renderHook(() => useLiquidityPoolStats());

    expect(result.current.totalActiveDeposited).toBe(0n);
    expect(result.current.minDeposit).toBe(0n);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns FALLBACK immediately when pools address is ZERO (no contract call needed)", () => {
    // Override for this single test: pools = ZERO address.
    mockGetContracts.mockReturnValueOnce({
      pools: "0x0000000000000000000000000000000000000000",
      depositVault: "0x0000000000000000000000000000000000000000",
      oddToken: "0x0000000000000000000000000000000000000000",
      stakingPool: "0x0000000000000000000000000000000000000000",
      lending: "0x0000000000000000000000000000000000000000",
      referral: "0x0000000000000000000000000000000000000000",
      usdc: "0x0000000000000000000000000000000000000000",
      usdt: "0x0000000000000000000000000000000000000000",
    });

    // Even if data existed it should never be consumed — poolAddress resolves to null.
    mockReadContractsReturn.data = [
      makeResult("success", 999n * 10n ** 18n),
      makeResult("success", 1n * 10n ** 18n),
      makeResult("success", true),
    ];

    const { result } = renderHook(() => useLiquidityPoolStats());

    expect(result.current.totalActiveDeposited).toBe(0n);
    expect(result.current.minDeposit).toBe(0n);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});
