// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// vi.hoisted — vi.mock 工厂被 hoisting 到文件顶部，普通 const 会进 TDZ
// 显式参数类型：避免 vi.fn(() => ...) 推断为 () => T 导致 mock.calls 被推为 []
const { mockUseRelayQuote, USER_ADDR } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mockUseRelayQuote: vi.fn((params: unknown) => ({ status: "idle" as const })),
  USER_ADDR: "0xUserEOA000000000000000000000000000000Abc" as `0x${string}`,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: USER_ADDR, isConnected: true }),
}));
vi.mock("@/hooks/useRelayQuote", () => ({
  useRelayQuote: mockUseRelayQuote,
}));
vi.mock("@/hooks/useRelayExecute", () => ({
  useRelayExecute: () => ({
    state: { status: "idle", currentStep: 0, totalSteps: 0, txHashes: [] },
    execute: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock("@/lib/chain-registry", () => ({
  getChainMeta: (chainId: number) => ({
    id: chainId,
    name: chainId === 56 ? "BNB Chain" : "Chain",
    slug: "bsc",
    iconUrl: "/images/chains/bsc.svg",
  }),
}));
vi.mock("./ChainSelector", () => ({
  ChainSelector: () => React.createElement("div"),
}));
vi.mock("./BridgeTokenSelector", () => ({
  BridgeTokenSelector: () => React.createElement("div"),
}));
vi.mock("./BridgeQuoteDisplay", () => ({
  BridgeQuoteDisplay: () => React.createElement("div"),
}));

// bridgeStore with valid fixtures for quote params to form
vi.mock("@/stores/bridgeStore", () => ({
  useBridgeStore: () => ({
    originChainId: 42161,
    originToken: {
      chainId: 42161,
      symbol: "USDT",
      name: "Tether USD",
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
      iconUrl: "",
    },
    destinationToken: {
      chainId: 56,
      symbol: "USDT",
      name: "Tether USD",
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
      iconUrl: "",
    },
    amount: "100",
    setOriginChainId: vi.fn(),
    setOriginToken: vi.fn(),
    setDestinationToken: vi.fn(),
    setAmount: vi.fn(),
    reset: vi.fn(),
  }),
}));

import { BridgeCard } from "./BridgeCard";

describe("BridgeCard — refundTo 契约", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useRelayQuote 入参包含 refundTo = 用户 EOA", () => {
    render(<BridgeCard />);

    expect(mockUseRelayQuote).toHaveBeenCalled();
    // 找最后一次 render 的 quoteParams（初次 render 可能入参为 null，后续 useMemo 已稳定）
    const calls = mockUseRelayQuote.mock.calls;
    const nonNullCall = calls.find((c) => c[0] !== null);
    expect(nonNullCall).toBeDefined();
    expect(nonNullCall?.[0]).toMatchObject({
      user: USER_ADDR,
      refundTo: USER_ADDR,
      chainId: 42161,
      toChainId: 56,
    });
  });
});
