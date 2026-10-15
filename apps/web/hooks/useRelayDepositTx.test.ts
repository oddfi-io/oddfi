// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── vi.hoisted：确保 mock 变量在 vi.mock 工厂函数执行前已初始化 ──────────────

const { mockUseRelayQuote, mockUseWalletClient, mockGetRelayClient } = vi.hoisted(() => ({
  mockUseRelayQuote: vi.fn(() => ({ status: "idle" as const })),
  mockUseWalletClient: vi.fn(() => ({ data: null })),
  mockGetRelayClient: vi.fn(),
}));

vi.mock("./useRelayQuote", () => ({ useRelayQuote: mockUseRelayQuote }));
vi.mock("wagmi", () => ({
  useWalletClient: mockUseWalletClient,
  useAccount: vi.fn(() => ({ address: undefined, isConnected: false })),
}));
vi.mock("@/lib/relay/client", () => ({ getRelayClient: mockGetRelayClient }));

import { useRelayDepositTx } from "./useRelayDepositTx";
import type { TokenMeta } from "@/lib/token-registry";

// ── 测试 fixtures ─────────────────────────────────────────────────────────────

/** Arbitrum USDT — 6 decimals（与 BSC USDT 18 decimals 的区别是关键测试要点） */
const ARB_USDT: TokenMeta = {
  chainId: 42161,
  symbol: "USDT",
  name: "Tether USD",
  address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  decimals: 6, // ETH/ARB/BASE/POLYGON USDT = 6 decimals
  iconUrl: "/images/tokens/usdt.svg",
  tier: 1,
};

/** BSC USDT — 18 decimals（BSC 特有） */
const BSC_USDT: TokenMeta = {
  chainId: 56,
  symbol: "USDT",
  name: "Tether USD",
  address: "0x55d398326f99059fF775485246999027B3197955",
  decimals: 18, // BSC USDT = 18 decimals
  iconUrl: "/images/tokens/usdt.svg",
  tier: 1,
};

const PROXY_WALLET = "0xProxyWalletBSC000000000000000000000000" as `0x${string}`;
const USER_ADDR = "0xUserEOA000000000000000000000000000000" as `0x${string}`;
const SOURCE_CHAIN_ARB = 42161;
const SOURCE_CHAIN_BSC = 56;

const BASE_OPTIONS = {
  selectedAsset: ARB_USDT,
  usdAmount: "100",
  assetUsdPrice: "1",
  proxyWalletAddress: PROXY_WALLET,
  userAddress: USER_ADDR,
  sourceChainId: SOURCE_CHAIN_ARB,
} as const;

// ── helpers ───────────────────────────────────────────────────────────────────

function renderRelayDepositHook(overrides = {}) {
  return renderHook(() => useRelayDepositTx({ ...BASE_OPTIONS, ...overrides }));
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("useRelayDepositTx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRelayQuote.mockReturnValue({ status: "idle" });
    mockUseWalletClient.mockReturnValue({ data: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 关键测试：decimals 正确性 ──────────────────────────────────────────────

  describe("源链 decimals 正确性（最高优先级）", () => {
    it("ARB USDT (6 dec)：100 USD → amountRaw = 100_000_000（6 位）", () => {
      renderRelayDepositHook({
        selectedAsset: ARB_USDT,
        usdAmount: "100",
        assetUsdPrice: "1",
        sourceChainId: SOURCE_CHAIN_ARB,
      });

      expect(mockUseRelayQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: "100000000", // parseUnits("100", 6)
          chainId: SOURCE_CHAIN_ARB,
          currency: ARB_USDT.address,
        })
      );
    });

    it("BSC USDT (18 dec)：100 USD → amountRaw = 100_000_000_000_000_000_000（18 位）", () => {
      renderRelayDepositHook({
        selectedAsset: BSC_USDT,
        usdAmount: "100",
        assetUsdPrice: "1",
        sourceChainId: SOURCE_CHAIN_BSC,
      });

      expect(mockUseRelayQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: "100000000000000000000", // parseUnits("100", 18)
          chainId: SOURCE_CHAIN_BSC,
          currency: BSC_USDT.address,
        })
      );
    });

    it("同一 USD 金额，6 dec vs 18 dec 产生 10^12 倍差异", () => {
      const callsArb: unknown[] = [];
      const callsBsc: unknown[] = [];

      (mockUseRelayQuote as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (params: any) => {
          if (params?.chainId === SOURCE_CHAIN_ARB) callsArb.push(params);
          else if (params?.chainId === SOURCE_CHAIN_BSC) callsBsc.push(params);
          return { status: "idle" };
        }
      );

      renderRelayDepositHook({ selectedAsset: ARB_USDT, sourceChainId: SOURCE_CHAIN_ARB });
      renderRelayDepositHook({ selectedAsset: BSC_USDT, sourceChainId: SOURCE_CHAIN_BSC });

      expect(callsArb[0]).toMatchObject({ amount: "100000000" }); // 10^8
      expect(callsBsc[0]).toMatchObject({ amount: "100000000000000000000" }); // 10^20
    });

    it("recipient = proxyWalletAddress（资金进代理钱包，不进用户 EOA）", () => {
      renderRelayDepositHook();
      expect(mockUseRelayQuote).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: PROXY_WALLET })
      );
    });

    it("user = userAddress（退款返回用户 EOA）", () => {
      renderRelayDepositHook();
      expect(mockUseRelayQuote).toHaveBeenCalledWith(expect.objectContaining({ user: USER_ADDR }));
    });

    it("refundTo = userAddress（失败退款落用户 EOA，而非 Proxy Wallet）", () => {
      renderRelayDepositHook();
      expect(mockUseRelayQuote).toHaveBeenCalledWith(
        expect.objectContaining({ refundTo: USER_ADDR })
      );
    });
  });

  // ── quoteParams null 场景 ──────────────────────────────────────────────────

  describe("quoteParams 为 null 的场景", () => {
    it("proxyWalletAddress 未定义 → useRelayQuote(null)", () => {
      renderRelayDepositHook({ proxyWalletAddress: undefined });
      expect(mockUseRelayQuote).toHaveBeenCalledWith(null);
    });

    it("userAddress 未定义 → useRelayQuote(null)", () => {
      renderRelayDepositHook({ userAddress: undefined });
      expect(mockUseRelayQuote).toHaveBeenCalledWith(null);
    });

    it("usdAmount 为空 → useRelayQuote(null)", () => {
      renderRelayDepositHook({ usdAmount: "" });
      expect(mockUseRelayQuote).toHaveBeenCalledWith(null);
    });

    it("assetUsdPrice 为 '0' → useRelayQuote(null)", () => {
      renderRelayDepositHook({ assetUsdPrice: "0" });
      expect(mockUseRelayQuote).toHaveBeenCalledWith(null);
    });
  });

  // ── 初始状态 ───────────────────────────────────────────────────────────────

  it("初始 phase 为 idle", () => {
    const { result } = renderRelayDepositHook();
    expect(result.current.phase).toBe("idle");
  });

  it("初始 txHash 为 undefined", () => {
    const { result } = renderRelayDepositHook();
    expect(result.current.txHash).toBeUndefined();
  });

  it("初始 errorMessage 为 undefined", () => {
    const { result } = renderRelayDepositHook();
    expect(result.current.errorMessage).toBeUndefined();
  });

  // ── execute() 前置检查 ─────────────────────────────────────────────────────

  describe("execute() 前置检查", () => {
    it("无 walletClient 时进入 failed，errorMessage 提示 Wallet not connected", async () => {
      mockUseWalletClient.mockReturnValue({ data: null });
      const { result } = renderRelayDepositHook();

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.phase).toBe("failed");
      expect(result.current.errorMessage).toMatch(/wallet not connected/i);
    });

    it("quoteState 非 success 时进入 failed", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockUseWalletClient.mockReturnValue({ data: {} as any });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockUseRelayQuote.mockReturnValue({ status: "loading" } as any);
      const { result } = renderRelayDepositHook();

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.phase).toBe("failed");
      expect(result.current.errorMessage).toMatch(/quote not available/i);
    });
  });

  // ── reset() ────────────────────────────────────────────────────────────────

  it("reset() 将 phase 重置为 idle，清除 errorMessage 和 txHash", async () => {
    mockUseWalletClient.mockReturnValue({ data: null });
    const { result } = renderRelayDepositHook();

    // 先触发 failed 状态
    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.phase).toBe("failed");

    act(() => {
      result.current.reset();
    });
    expect(result.current.phase).toBe("idle");
    expect(result.current.errorMessage).toBeUndefined();
    expect(result.current.txHash).toBeUndefined();
  });

  // ── 完整执行流（mock relay client）────────────────────────────────────────

  it("execute() 成功后 phase 变为 complete", async () => {
    const mockWalletClient = { type: "walletClient" };
    const mockQuote = { steps: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseWalletClient.mockReturnValue({ data: mockWalletClient as any });
    mockUseRelayQuote.mockReturnValue({
      status: "success",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quote: mockQuote as any,
      expiresAt: Date.now() + 28000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockGetRelayClient.mockResolvedValue({
      actions: {
        execute: vi.fn().mockResolvedValue({ data: mockQuote }),
      },
    });

    const { result } = renderRelayDepositHook();

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.phase).toBe("complete");
  });

  it("execute() 抛出错误后 phase 变为 failed", async () => {
    const mockWalletClient = { type: "walletClient" };
    const mockQuote = { steps: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseWalletClient.mockReturnValue({ data: mockWalletClient as any });
    mockUseRelayQuote.mockReturnValue({
      status: "success",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quote: mockQuote as any,
      expiresAt: Date.now() + 28000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockGetRelayClient.mockResolvedValue({
      actions: {
        execute: vi.fn().mockRejectedValue(new Error("User rejected the transaction")),
      },
    });

    const { result } = renderRelayDepositHook();

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.errorMessage).toMatch(/user rejected/i);
  });
});

/**
 * DD-079: testnet 下 execute 必须抛错（defense-in-depth 兜底），
 * 即使 UI 层 Step5TransactionConfirm 被绕过也不会意外调到 Relay。
 */
describe("useRelayDepositTx DD-079 testnet 禁用", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "testnet");
    mockUseRelayQuote.mockReturnValue({ status: "idle" });
    mockUseWalletClient.mockReturnValue({ data: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("testnet 模式下 execute() 抛出 disabled 错误", async () => {
    const { useRelayDepositTx: hook } = await import("./useRelayDepositTx");
    const { result } = renderHook(() => hook(BASE_OPTIONS));
    await expect(result.current.execute()).rejects.toThrow(/Relay disabled in testnet/);
  });
});
