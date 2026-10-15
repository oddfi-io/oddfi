import { describe, it, expect, beforeEach } from "vitest";
import { mainnet } from "wagmi/chains";
import { useBridgeStore } from "./bridgeStore";
import type { TokenMeta } from "@/lib/token-registry";

const MOCK_TOKEN_ETH: TokenMeta = {
  chainId: 1,
  symbol: "USDT",
  name: "Tether USD",
  address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  decimals: 6,
  iconUrl: "",
  tier: 0,
};

const MOCK_TOKEN_BSC: TokenMeta = {
  chainId: 56,
  symbol: "USDT",
  name: "Tether USD",
  address: "0x55d398326f99059fF775485246999027B3197955",
  decimals: 18,
  iconUrl: "",
  tier: 0,
};

describe("useBridgeStore", () => {
  beforeEach(() => {
    useBridgeStore.getState().reset();
  });

  it("初始状态：originChainId = mainnet, 其他字段为空", () => {
    const state = useBridgeStore.getState();
    expect(state.originChainId).toBe(mainnet.id);
    expect(state.originToken).toBeNull();
    expect(state.destinationToken).toBeNull();
    expect(state.amount).toBe("");
  });

  it("setOriginToken — 设置源代币", () => {
    useBridgeStore.getState().setOriginToken(MOCK_TOKEN_ETH);
    expect(useBridgeStore.getState().originToken).toEqual(MOCK_TOKEN_ETH);
  });

  it("setOriginChainId — 切换源链时清空 originToken（防止跨链地址错配）", () => {
    // 先设置代币，再切换链
    useBridgeStore.getState().setOriginToken(MOCK_TOKEN_ETH);
    expect(useBridgeStore.getState().originToken).not.toBeNull();

    useBridgeStore.getState().setOriginChainId(137); // 切到 Polygon
    expect(useBridgeStore.getState().originChainId).toBe(137);
    expect(useBridgeStore.getState().originToken).toBeNull(); // 已清空
  });

  it("setOriginChainId — 切换到同一链不影响其他状态", () => {
    useBridgeStore.getState().setAmount("10");
    useBridgeStore.getState().setOriginChainId(mainnet.id);
    expect(useBridgeStore.getState().amount).toBe("10");
    expect(useBridgeStore.getState().originChainId).toBe(mainnet.id);
  });

  it("setDestinationToken — 设置目标代币", () => {
    useBridgeStore.getState().setDestinationToken(MOCK_TOKEN_BSC);
    expect(useBridgeStore.getState().destinationToken).toEqual(MOCK_TOKEN_BSC);
  });

  it("setAmount — 设置金额", () => {
    useBridgeStore.getState().setAmount("1.5");
    expect(useBridgeStore.getState().amount).toBe("1.5");
  });

  it("reset — 恢复初始状态", () => {
    useBridgeStore.getState().setOriginChainId(137);
    useBridgeStore.getState().setOriginToken(MOCK_TOKEN_ETH);
    useBridgeStore.getState().setDestinationToken(MOCK_TOKEN_BSC);
    useBridgeStore.getState().setAmount("100");

    useBridgeStore.getState().reset();

    const state = useBridgeStore.getState();
    expect(state.originChainId).toBe(mainnet.id);
    expect(state.originToken).toBeNull();
    expect(state.destinationToken).toBeNull();
    expect(state.amount).toBe("");
  });
});
