// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDepositTx } from "./useDepositTx";
import type { TokenMeta } from "@/lib/token-registry";

// ── Mocks ────────────────────────────────────────────────────────

const mockWriteContract = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890abcdef1234567890abcdef12345678" }),
  useWriteContract: () => ({
    writeContract: mockWriteContract,
    data: undefined,
    isPending: false,
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: false,
  }),
  useReadContract: () => ({ data: undefined, refetch: vi.fn() }),
}));

vi.mock("./useProxyWallet", () => ({
  useProxyWallet: () => ({
    wallet: { address: "0xabcdef1234567890abcdef1234567890abcdef12", network: "BSC", chainId: 56 },
    isLoading: false,
  }),
}));

vi.mock("@/lib/swap/pancake-adapter", () => ({
  usePancakeQuote: () => ({
    data: {
      amountOut: 1000000000000000000n,
      amountOutFormatted: "1.05",
      rate: "650.00",
      path: [
        "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "0x55d398326f99059fF775485246999027B3197955",
      ],
      priceImpact: "0.250",
      minReceived: 995000000000000000n,
      minReceivedFormatted: "0.995",
      amountIn: 1000000000000000n,
    },
    isLoading: false,
    error: null,
  }),
  createPancakeSwap: () => ({
    needsApproval: vi.fn().mockResolvedValue(false),
    approve: vi.fn().mockResolvedValue("0xapprove"),
    execute: vi.fn().mockResolvedValue("0xswaphash"),
  }),
}));

vi.mock("./useTokenApproval", () => ({
  useTokenApproval: () => ({
    needsApproval: false,
    isApproving: false,
    isApproveConfirmed: false,
    approveTxHash: undefined,
    approve: vi.fn(),
    refetchAllowance: vi.fn(),
  }),
}));

// ── Test token fixtures ──────────────────────────────────────────

const MOCK_BNB: TokenMeta = {
  symbol: "BNB",
  name: "BNB",
  address: "0x0000000000000000000000000000000000000000",
  decimals: 18,
  iconUrl: "https://example.com/bnb.png",
  tier: 9,
  isNative: true,
  chainId: 56,
};

const MOCK_TODD: TokenMeta = {
  symbol: "TODD",
  name: "Todd",
  address: "0xa3049f4C5b196EbDE022eBedA6673683E5eC49b7",
  decimals: 18,
  iconUrl: "https://example.com/todd.png",
  tier: 1,
  chainId: 56,
};

// ── Tests ────────────────────────────────────────────────────────

describe("useDepositTx", () => {
  beforeEach(() => {
    mockWriteContract.mockClear();
  });

  it("starts in idle phase", () => {
    const { result } = renderHook(() =>
      useDepositTx({
        selectedAsset: MOCK_BNB,
        usdAmount: "50",
        assetUsdPrice: "650",
        isPlatformToken: false,
      })
    );

    expect(result.current.phase).toBe("idle");
    expect(result.current.txHash).toBeUndefined();
    expect(result.current.errorMessage).toBeUndefined();
  });

  it("transfer path (isPlatformToken): calls writeContract with transfer", () => {
    const { result } = renderHook(() =>
      useDepositTx({
        selectedAsset: MOCK_TODD,
        usdAmount: "100",
        assetUsdPrice: "1",
        isPlatformToken: true,
      })
    );

    act(() => {
      result.current.execute();
    });

    expect(result.current.phase).toBe("executing");
    expect(mockWriteContract).toHaveBeenCalledTimes(1);

    const callArgs = mockWriteContract.mock.calls[0][0];
    expect(callArgs.functionName).toBe("transfer");
  });

  it("reset brings state back to idle", () => {
    const { result } = renderHook(() =>
      useDepositTx({
        selectedAsset: MOCK_TODD,
        usdAmount: "100",
        assetUsdPrice: "1",
        isPlatformToken: true,
      })
    );

    act(() => {
      result.current.execute();
    });
    expect(result.current.phase).toBe("executing");

    act(() => {
      result.current.reset();
    });
    expect(result.current.phase).toBe("idle");
    expect(result.current.txHash).toBeUndefined();
  });

  it("provides quoteData for platform token transfer", () => {
    const { result } = renderHook(() =>
      useDepositTx({
        selectedAsset: MOCK_TODD,
        usdAmount: "100",
        assetUsdPrice: "1",
        isPlatformToken: true,
      })
    );

    expect(result.current.quoteData).not.toBeNull();
    expect(result.current.quoteData!.priceImpact).toBe("0");
    expect(result.current.quoteData!.rate).toBe("1.000000");
  });

  it("provides quoteData from on-chain quote for swap path", () => {
    const { result } = renderHook(() =>
      useDepositTx({
        selectedAsset: MOCK_BNB,
        usdAmount: "1",
        assetUsdPrice: "650",
        isPlatformToken: false,
      })
    );

    expect(result.current.quoteData).not.toBeNull();
    expect(result.current.quoteData!.amountOutFormatted).toBe("1.05");
    expect(result.current.quoteData!.priceImpact).toBe("0.250");
  });
});
