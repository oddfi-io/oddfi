// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { Step5RelayConfirm } from "./Step5RelayConfirm";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/useProxyWallet");
vi.mock("@/hooks/useWallet");
vi.mock("@/hooks/useNetworkGuard");
vi.mock("@/hooks/useRelayDepositTx");
vi.mock("@/hooks/useConnectedWalletIcon", () => ({
  useConnectedWalletIcon: vi.fn(() => undefined),
}));
vi.mock("wagmi", () => ({
  useWalletClient: vi.fn(() => ({ data: { account: { address: "0xUser" } } })),
}));
// BD-008: lib/wallet-chain imports wagmi.config which needs wagmi/http at module-load time.
// Mock the whole module to cut the dependency chain for this test file.
vi.mock("@/lib/wallet-chain", () => ({
  ensureCoreChain: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/chain-registry", () => ({
  getChainMeta: (chainId: number) => ({
    id: chainId,
    name: chainId === 42161 ? "Arbitrum" : chainId === 56 ? "BNB Chain" : `chain ${chainId}`,
    slug: "",
    iconUrl: "",
  }),
}));

// Stub TransactionConfirmCard — exposes confirmLabel / disabled / summary for assertions
interface StubSummary {
  receiveAmount?: string;
  networkCost?: string;
  estimatedTime?: string;
}

vi.mock("@/components/transaction/TransactionConfirmCard", () => ({
  TransactionConfirmCard: ({
    summary,
    confirmLabel,
    onConfirm,
    disabled,
    isLoading,
  }: {
    summary: StubSummary;
    confirmLabel: string;
    onConfirm: () => void;
    isLoading: boolean;
    disabled: boolean;
  }) =>
    React.createElement(
      "button",
      {
        "data-testid": "confirm-btn",
        "data-receive-amount": summary?.receiveAmount ?? "",
        "data-network-cost": summary?.networkCost ?? "",
        "data-estimated-time": summary?.estimatedTime ?? "",
        onClick: onConfirm,
        disabled: disabled || isLoading,
      },
      confirmLabel
    ),
}));

import { useProxyWallet } from "@/hooks/useProxyWallet";
import { useWallet } from "@/hooks/useWallet";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { useRelayDepositTx } from "@/hooks/useRelayDepositTx";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_WALLET = {
  address: "0xProxy000000000000000000000000000000000001" as `0x${string}`,
  network: "bsc",
  chainId: 56,
};
const MOCK_EOA = "0xUser0000000000000000000000000000000001" as `0x${string}`;

const BASE_TX = {
  phase: "idle" as const,
  txHash: undefined,
  errorMessage: undefined,
  quoteState: { status: "idle" as const },
  execute: vi.fn(),
  reset: vi.fn(),
};

const DEFAULT_PROPS = {
  selectedAsset: {
    chainId: 42161,
    symbol: "USDT",
    name: "Tether USD",
    address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as `0x${string}`,
    decimals: 6,
    isNative: false,
    iconUrl: "/images/tokens/usdt.svg",
    tier: 8,
  },
  usdAmount: "50",
  assetUsdPrice: "1.00",
  onSuccess: vi.fn(),
  onTxResult: vi.fn(),
};

function setupMocks(
  overrides: {
    walletLoading?: boolean;
    wallet?: typeof MOCK_WALLET | null;
    address?: `0x${string}` | undefined;
    tx?: Partial<ReturnType<typeof useRelayDepositTx>>;
    /** 钱包当前链（决定 isOnChain(sourceChainId) 结果）*/
    walletChainId?: number;
    isSwitching?: boolean;
  } = {}
) {
  const {
    walletLoading = false,
    wallet = MOCK_WALLET,
    address = MOCK_EOA,
    tx = {},
    walletChainId = 42161, // 默认钱包在 ARB — 匹配 selectedAsset.chainId
    isSwitching = false,
  } = overrides;

  vi.mocked(useProxyWallet).mockReturnValue({
    wallet,
    isLoading: walletLoading,
  } as ReturnType<typeof useProxyWallet>);

  vi.mocked(useWallet).mockReturnValue({
    address,
  } as ReturnType<typeof useWallet>);

  const switchToFn = vi.fn();
  vi.mocked(useNetworkGuard).mockReturnValue({
    isOnChain: (chainId: number) => chainId === walletChainId,
    switchTo: switchToFn,
    isSwitching,
  } as unknown as ReturnType<typeof useNetworkGuard>);

  vi.mocked(useRelayDepositTx).mockReturnValue({
    ...BASE_TX,
    ...tx,
  } as ReturnType<typeof useRelayDepositTx>);

  return { switchToFn };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Step5RelayConfirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading states ──────────────────────────────────────────────────────────

  it("shows loading skeleton when wallet is still loading", () => {
    setupMocks({ walletLoading: true, wallet: null });
    render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
    expect(screen.queryByTestId("confirm-btn")).toBeNull();
  });

  it("shows loading skeleton when wallet is null", () => {
    setupMocks({ wallet: null });
    render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
    expect(screen.queryByTestId("confirm-btn")).toBeNull();
  });

  it("shows loading skeleton when EOA address is undefined (W1 null-summary guard)", () => {
    // setupMocks default has address=MOCK_EOA; override directly to test address=undefined
    // (JS destructuring uses default for `undefined`, so we must set the mock after setupMocks)
    setupMocks();
    vi.mocked(useWallet).mockReturnValue({ address: undefined } as ReturnType<typeof useWallet>);
    render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
    expect(screen.queryByTestId("confirm-btn")).toBeNull();
  });

  // ── Chain switch guard ──────────────────────────────────────────────────────

  describe("一键跨链流水（自动切链 + 自动 execute）", () => {
    it("钱包在 BSC、资产在 ARB、quote ready → 按钮文案统一 'Confirm Cross-chain Transfer'（不暴露切链分支）", () => {
      setupMocks({
        walletChainId: 56,
        tx: {
          quoteState: {
            status: "success",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            quote: {} as any,
            expiresAt: Date.now() + 30000,
          },
        },
      });
      render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      expect(screen.getByTestId("confirm-btn").textContent).toBe("Confirm Cross-chain Transfer");
    });

    it("点击时若不在源链 → 触发 switchTo(sourceChainId) 且不直接 execute（等 effect 推进）", () => {
      const executeFn = vi.fn();
      const { switchToFn } = setupMocks({
        walletChainId: 56,
        tx: {
          quoteState: {
            status: "success",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            quote: {} as any,
            expiresAt: Date.now() + 30000,
          },
          execute: executeFn,
        },
      });
      render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      act(() => {
        screen.getByTestId("confirm-btn").click();
      });
      expect(switchToFn).toHaveBeenCalledWith(42161);
      expect(executeFn).not.toHaveBeenCalled();
    });

    it("切链进行中 isSwitching=true → 按钮 disabled + 文案 'Switching to Arbitrum...'", () => {
      setupMocks({ walletChainId: 56, isSwitching: true });
      render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      const btn = screen.getByTestId("confirm-btn");
      expect(btn.textContent).toBe("Switching to Arbitrum...");
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it("钱包在 ARB（匹配资产链）→ 按钮文案 'Confirm Cross-chain Transfer'", () => {
      setupMocks({ walletChainId: 42161 });
      render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      expect(screen.getByTestId("confirm-btn").textContent).toBe("Confirm Cross-chain Transfer");
    });

    it("切链成功后 effect 自动推进 intent=awaitQuote → execute 被调用", async () => {
      const executeFn = vi.fn();
      // 初始：钱包在 BSC，isSwitching=false → 用户点击 → intent=awaitSwitch
      const { switchToFn } = setupMocks({
        walletChainId: 56,
        tx: {
          quoteState: {
            status: "success",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            quote: {} as any,
            expiresAt: Date.now() + 30000,
          },
          execute: executeFn,
        },
      });
      const { rerender } = render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      await act(async () => {
        screen.getByTestId("confirm-btn").click();
      });
      expect(switchToFn).toHaveBeenCalledWith(42161);
      expect(executeFn).not.toHaveBeenCalled();

      // 切链成功：钱包切到 ARB，isSwitching=false → effect 推进 awaitSwitch → awaitQuote → executing
      setupMocks({
        walletChainId: 42161,
        tx: {
          quoteState: {
            status: "success",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            quote: {} as any,
            expiresAt: Date.now() + 30000,
          },
          execute: executeFn,
        },
      });
      await act(async () => {
        rerender(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      });
      expect(executeFn).toHaveBeenCalledOnce();
    });
  });

  // ── Quote state labels ──────────────────────────────────────────────────────

  it("shows default label and disables button when quoteState is idle", () => {
    setupMocks();
    render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
    const btn = screen.getByTestId("confirm-btn");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.textContent).toBe("Confirm Cross-chain Transfer");
  });

  it("shows 'Getting quote...' when quoteState is loading", () => {
    setupMocks({ tx: { quoteState: { status: "loading" } } });
    render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("confirm-btn").textContent).toBe("Getting quote...");
  });

  it("shows 'Quote expired, refreshing...' and disables button when quoteState is expired", () => {
    setupMocks({ tx: { quoteState: { status: "expired" } } });
    render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
    const btn = screen.getByTestId("confirm-btn");
    expect(btn.textContent).toBe("Quote expired, refreshing...");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  // ── Processing phase labels ─────────────────────────────────────────────────

  it("shows 'Approving...' during approve phase", () => {
    setupMocks({
      tx: {
        phase: "approve",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quoteState: { status: "success", quote: {} as any, expiresAt: Date.now() + 30000 },
      },
    });
    render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("confirm-btn").textContent).toBe("Approving...");
  });

  it("shows 'Bridging...' during relaying phase", () => {
    setupMocks({
      tx: {
        phase: "relaying",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quoteState: { status: "success", quote: {} as any, expiresAt: Date.now() + 30000 },
      },
    });
    render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("confirm-btn").textContent).toBe("Bridging...");
  });

  // ── Error state ─────────────────────────────────────────────────────────────

  it("renders error message when phase is failed", () => {
    setupMocks({
      tx: { phase: "failed", errorMessage: "Transaction failed. Refund initiated to your wallet." },
    });
    render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
    expect(screen.getByText("Transaction failed. Refund initiated to your wallet.")).toBeTruthy();
  });

  // ── Execute ─────────────────────────────────────────────────────────────────

  it("calls execute() when confirm button is clicked with valid quote", () => {
    const executeFn = vi.fn();
    setupMocks({
      tx: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quoteState: { status: "success", quote: {} as any, expiresAt: Date.now() + 30000 },
        execute: executeFn,
      },
    });
    render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
    const btn = screen.getByTestId("confirm-btn");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    act(() => {
      btn.click();
    });
    expect(executeFn).toHaveBeenCalledOnce();
  });

  // ── Completion callbacks ────────────────────────────────────────────────────

  it("calls onSuccess and onTxResult when phase transitions to complete", async () => {
    const onSuccess = vi.fn();
    const onTxResult = vi.fn();

    setupMocks({ tx: { phase: "idle" } });
    const { rerender } = render(
      <Step5RelayConfirm {...DEFAULT_PROPS} onSuccess={onSuccess} onTxResult={onTxResult} />
    );
    expect(onSuccess).not.toHaveBeenCalled();

    // Simulate Relay completing
    vi.mocked(useRelayDepositTx).mockReturnValue({
      ...BASE_TX,
      phase: "complete",
    } as ReturnType<typeof useRelayDepositTx>);

    await act(async () => {
      rerender(
        <Step5RelayConfirm {...DEFAULT_PROPS} onSuccess={onSuccess} onTxResult={onTxResult} />
      );
    });

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onTxResult).toHaveBeenCalledOnce();
  });

  // ── Batch 2：quote.details 字段对齐 ───────────────────────────────────────
  describe("quote.details 字段对齐（Batch 2）", () => {
    it("receiveAmount 读 quote.details.currencyOut.amountFormatted（替代 usdAmount 硬等）", () => {
      setupMocks({
        tx: {
          quoteState: {
            status: "success",
            quote: {
              details: {
                currencyOut: { amountFormatted: "49.75123" },
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            expiresAt: Date.now() + 30000,
          },
        },
      });
      render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      // 49.75123 → formatAmount 5 位 → 49.75123
      expect(screen.getByTestId("confirm-btn").getAttribute("data-receive-amount")).toBe(
        "49.75123"
      );
    });

    it("networkCost 读 quote.details.totalImpact.usd（负值取绝对值）", () => {
      setupMocks({
        tx: {
          quoteState: {
            status: "success",
            quote: {
              details: {
                totalImpact: { usd: "-0.2456" },
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            expiresAt: Date.now() + 30000,
          },
        },
      });
      render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      // formatAmount 为截断非四舍五入：0.2456 → "0.245"
      expect(screen.getByTestId("confirm-btn").getAttribute("data-network-cost")).toBe("~$0.245");
    });

    it("estimatedTime 读 quote.details.timeEstimate（秒，<60 秒直接展示）", () => {
      setupMocks({
        tx: {
          quoteState: {
            status: "success",
            quote: {
              details: { timeEstimate: 8 },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            expiresAt: Date.now() + 30000,
          },
        },
      });
      render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      expect(screen.getByTestId("confirm-btn").getAttribute("data-estimated-time")).toBe("8s");
    });

    it("estimatedTime ≥ 60 秒时折分钟（180s → 3m）", () => {
      setupMocks({
        tx: {
          quoteState: {
            status: "success",
            quote: {
              details: { timeEstimate: 180 },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            expiresAt: Date.now() + 30000,
          },
        },
      });
      render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      expect(screen.getByTestId("confirm-btn").getAttribute("data-estimated-time")).toBe("3m");
    });

    it("quote.details 字段缺失时 fallback 到旧硬编码（receiveAmount=usdAmount, $0.10, 2–4s）", () => {
      setupMocks({
        tx: {
          quoteState: {
            status: "success",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            quote: { details: {} } as any,
            expiresAt: Date.now() + 30000,
          },
        },
      });
      render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      const btn = screen.getByTestId("confirm-btn");
      // usdAmount="50" → formatAmount(5 位) → "50.00000"
      expect(btn.getAttribute("data-receive-amount")).toBe("50.00000");
      expect(btn.getAttribute("data-network-cost")).toBe("~$0.10");
      expect(btn.getAttribute("data-estimated-time")).toBe("2–4s");
    });

    it("quoteState 非 success 时保持 fallback 值", () => {
      setupMocks({
        tx: { quoteState: { status: "loading" } },
      });
      render(<Step5RelayConfirm {...DEFAULT_PROPS} />);
      const btn = screen.getByTestId("confirm-btn");
      expect(btn.getAttribute("data-receive-amount")).toBe("50.00000");
      expect(btn.getAttribute("data-network-cost")).toBe("~$0.10");
      expect(btn.getAttribute("data-estimated-time")).toBe("2–4s");
    });
  });

  it("does not call onSuccess twice if parent re-renders while phase remains complete (W2 guard)", async () => {
    const onSuccess = vi.fn();

    vi.mocked(useRelayDepositTx).mockReturnValue({
      ...BASE_TX,
      phase: "complete",
    } as ReturnType<typeof useRelayDepositTx>);
    setupMocks({ tx: { phase: "complete" } });

    const { rerender } = render(<Step5RelayConfirm {...DEFAULT_PROPS} onSuccess={onSuccess} />);

    // Re-render with same phase (simulates unstable onSuccess ref triggering effect again)
    const newOnSuccess = vi.fn();
    await act(async () => {
      rerender(<Step5RelayConfirm {...DEFAULT_PROPS} onSuccess={newOnSuccess} />);
    });

    // First render's onSuccess called once; second render's newOnSuccess never called
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(newOnSuccess).not.toHaveBeenCalled();
  });
});
