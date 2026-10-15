// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { parseUnits } from "viem";
import UserStakeStats from "./UserStakeStats";
import en from "../../messages/en.json";

let mockAddress: `0x${string}` | undefined = undefined;
let mockReadData: unknown = undefined;
// 捕获最近一次 useReadContracts 入参，用于断言地址门控对 query.enabled 的影响（DD-147）
let lastReadContractsArg: { query?: { enabled?: boolean } } | undefined;

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: mockAddress }),
  useReadContracts: (arg: { query?: { enabled?: boolean } }) => {
    lastReadContractsArg = arg;
    return { data: mockReadData, isLoading: false };
  },
}));

// DD-147：UserStakeStats 已删 IS_TESTNET 业务闸，可用性门控收敛到 stakingPool 地址。
vi.mock("@/lib/wagmi.config", () => ({ CORE_CHAIN: { id: 97 } }));
vi.mock("@/lib/platform-token", () => ({ PLATFORM_TOKEN_DISPLAY: "OFI" }));

const STAKING_CONFIGURED = {
  pools: "0x0000000000000000000000000000000000000001",
  depositVault: "0x0000000000000000000000000000000000000000",
  oddToken: "0x0000000000000000000000000000000000000000",
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

function renderStats(totalPendingReward = "0") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <UserStakeStats totalPendingReward={totalPendingReward} />
    </NextIntlClientProvider>
  );
}

describe("UserStakeStats", () => {
  beforeEach(() => {
    mockAddress = undefined;
    mockReadData = undefined;
    lastReadContractsArg = undefined;
    mockGetContracts.mockReset();
    mockGetContracts.mockReturnValue(STAKING_CONFIGURED);
  });

  it("renders nothing when wallet not connected", () => {
    const { container } = renderStats();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when isActiveStaker is false", () => {
    mockAddress = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
    mockReadData = [
      { status: "success", result: 0n },
      { status: "success", result: 0 },
      { status: "success", result: 0n },
      { status: "success", result: false },
    ];
    const { container } = renderStats();
    expect(container.firstChild).toBeNull();
  });

  it("renders 4 stat cards when user is active staker", () => {
    mockAddress = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
    mockReadData = [
      { status: "success", result: parseUnits("123.45", 18) },
      { status: "success", result: 3 },
      { status: "success", result: parseUnits("999", 18) },
      { status: "success", result: true },
    ];
    renderStats("8.5");
    expect(screen.getByText("Total Active Stake")).toBeDefined();
    expect(screen.getByText("Pending Rewards")).toBeDefined();
    expect(screen.getByText("VIP Tier")).toBeDefined();
    expect(screen.getByText("Daily Bet Limit")).toBeDefined();
    expect(screen.getByText("VIP 3")).toBeDefined();
  });

  // DD-147：stakingPool 未配置（ZERO）→ isAvailable=false → 链上读取被禁用（enabled=false）
  it("disables on-chain read (enabled=false) when stakingPool address is ZERO", () => {
    mockGetContracts.mockReturnValue({
      ...STAKING_CONFIGURED,
      stakingPool: "0x0000000000000000000000000000000000000000",
    });
    mockAddress = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
    renderStats();
    // 地址未配置 → 即使钱包已连接，门控也应禁用 multicall
    expect(lastReadContractsArg?.query?.enabled).toBe(false);
  });

  // 对照：已配置 + 已连接钱包 → 链上读取启用
  it("enables on-chain read when stakingPool configured and wallet connected", () => {
    mockAddress = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
    renderStats();
    expect(lastReadContractsArg?.query?.enabled).toBe(true);
  });
});
