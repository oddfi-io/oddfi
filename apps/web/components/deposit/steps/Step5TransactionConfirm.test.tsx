// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

// ── 路由判据测试：selectedAsset.chainId === CORE_CHAIN.id 选 Pancake，否则 Relay
// 目的：替代旧版 `isOnCoreChain`（钱包链）判据 —— 钱包在 BSC 选 ARB USDT 应走 Relay

const relayStub = vi.fn();

// next-intl mock：Step5PancakeConfirm 内部用 useTranslations，需桩化避免 Provider 报错
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("./Step5RelayConfirm", () => ({
  Step5RelayConfirm: (props: unknown) => {
    relayStub(props);
    return React.createElement("div", { "data-testid": "relay-confirm" });
  },
}));

// Pancake confirm 内部依赖 useProxyWallet/useDepositTx 等繁琐 mock —— 直接 stub 整个 Step5TransactionConfirm 的兄弟 Step5PancakeConfirm 实现无从下手（同文件导出），
// 因此通过对 useNetworkGuard/useProxyWallet 等依赖做轻量 mock，验证 Pancake 分支被选中（数据测试 id 存在）。
// 这里精简做法：仅验证"非 BSC 资产 → relay 子组件被渲染"和"BSC 资产 → 非 relay 子组件（Pancake）被渲染"。

vi.mock("@/hooks/useProxyWallet", () => ({
  useProxyWallet: () => ({ wallet: null, isLoading: true }),
}));
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ address: undefined }),
}));
vi.mock("@/hooks/useDepositTx", () => ({
  useDepositTx: () => ({ phase: "idle", quoteData: undefined, execute: vi.fn() }),
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ connector: undefined }),
}));
vi.mock("@/components/wallet/walletConfig", () => ({
  WALLETS: [],
  resolveWalletId: () => undefined,
  getConnectedWallet: () => null,
}));
vi.mock("@/lib/proxy-wallet/utils", () => ({
  buildTxSummary: () => null,
}));

import { Step5TransactionConfirm } from "./Step5TransactionConfirm";

const BSC_ASSET = {
  chainId: 56,
  symbol: "USDT",
  name: "Tether USD",
  address: "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`,
  decimals: 18,
  isNative: false,
  iconUrl: "/images/tokens/usdt.svg",
  tier: 1,
};

const ARB_ASSET = {
  chainId: 42161,
  symbol: "USDT",
  name: "Tether USD",
  address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as `0x${string}`,
  decimals: 6,
  isNative: false,
  iconUrl: "/images/tokens/usdt.svg",
  tier: 1,
};

describe("Step5TransactionConfirm — 路由判据", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    relayStub.mockClear();
  });

  it("selectedAsset 在 BSC → Pancake 分支（不渲染 Relay）", () => {
    const { queryByTestId } = render(
      <Step5TransactionConfirm
        selectedAsset={BSC_ASSET}
        usdAmount="50"
        assetUsdPrice="1"
        onSuccess={() => {}}
      />
    );
    expect(queryByTestId("relay-confirm")).toBeNull();
    expect(relayStub).not.toHaveBeenCalled();
  });

  it("selectedAsset 在 Arbitrum → Relay 分支", () => {
    const { getByTestId } = render(
      <Step5TransactionConfirm
        selectedAsset={ARB_ASSET}
        usdAmount="50"
        assetUsdPrice="1"
        onSuccess={() => {}}
      />
    );
    expect(getByTestId("relay-confirm")).toBeTruthy();
    expect(relayStub).toHaveBeenCalledOnce();
    // Relay 子组件收到完整透传 props（不再依赖 sourceChainId store 字段）
    expect(relayStub.mock.calls[0]?.[0]).toMatchObject({
      selectedAsset: expect.objectContaining({ chainId: 42161 }),
    });
  });
});
