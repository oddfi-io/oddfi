import { describe, it, expect, vi, beforeEach } from "vitest";
import { bsc, arbitrum } from "wagmi/chains";

// Mock wagmi useSwitchChain + useAccount（ENH-018 新增 isConnecting/isConnected 读 status）
vi.mock("wagmi", () => ({
  useSwitchChain: vi.fn(),
  useAccount: vi.fn(),
}));

// Mock useWallet to control wallet state
vi.mock("./useWallet", () => ({
  useWallet: vi.fn(),
}));

import { useSwitchChain, useAccount } from "wagmi";
import { useWallet } from "./useWallet";
import { useNetworkGuard } from "./useNetworkGuard";

const mockSwitchChain = vi.fn();

function setupMocks({
  isConnected,
  isWrongNetwork,
  chain = bsc,
}: {
  isConnected: boolean;
  isWrongNetwork: boolean;
  chain?: typeof bsc | typeof arbitrum;
}) {
  vi.mocked(useWallet).mockReturnValue({
    isConnected,
    isWrongNetwork,
    chain: isConnected ? chain : undefined,
    address: isConnected ? ("0xabc" as `0x${string}`) : undefined,
    nativeBalance: undefined,
    connect: vi.fn(),
    disconnect: vi.fn(),
    isDisconnecting: false,
  });

  vi.mocked(useAccount).mockReturnValue({
    status: isConnected ? "connected" : "disconnected",
  } as unknown as ReturnType<typeof useAccount>);

  vi.mocked(useSwitchChain).mockReturnValue({
    switchChain: mockSwitchChain,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useSwitchChain>);
}

describe("useNetworkGuard", () => {
  beforeEach(() => {
    mockSwitchChain.mockReset();
  });

  describe("未连接态", () => {
    it("isDisconnected = true, canOperate = false, canOperateOnCore = false", () => {
      setupMocks({ isConnected: false, isWrongNetwork: false });
      const result = useNetworkGuard();
      expect(result.isDisconnected).toBe(true);
      expect(result.canOperate).toBe(false);
      expect(result.canOperateOnCore).toBe(false);
      expect(result.isOnCoreChain).toBe(false);
      expect(result.isWrongNetwork).toBe(false);
    });
  });

  describe("已连接·核心链（BSC）", () => {
    it("canOperate = true, canOperateOnCore = true, isOnCoreChain = true", () => {
      setupMocks({ isConnected: true, isWrongNetwork: false, chain: bsc });
      const result = useNetworkGuard();
      expect(result.canOperate).toBe(true);
      expect(result.canOperateOnCore).toBe(true);
      expect(result.isOnCoreChain).toBe(true);
      expect(result.isDisconnected).toBe(false);
    });

    it("coreChain is BSC", () => {
      setupMocks({ isConnected: true, isWrongNetwork: false });
      const result = useNetworkGuard();
      expect(result.coreChain.id).toBe(bsc.id);
    });
  });

  describe("已连接·非核心链（Arbitrum — supported, non-core）", () => {
    it("canOperate = true, canOperateOnCore = false, isOnCoreChain = false, isWrongNetwork = false", () => {
      setupMocks({ isConnected: true, isWrongNetwork: false, chain: arbitrum });
      const result = useNetworkGuard();
      expect(result.canOperate).toBe(true);
      expect(result.canOperateOnCore).toBe(false);
      expect(result.isOnCoreChain).toBe(false);
      // Arbitrum is a supported chain — should NOT be flagged as wrong network
      expect(result.isWrongNetwork).toBe(false);
      expect(result.isDisconnected).toBe(false);
    });
  });

  describe("已连接·不支持的链（Optimism — unsupported, isWrongNetwork = true）", () => {
    it("isWrongNetwork = true, canOperate = false, canOperateOnCore = false", () => {
      // Optimism is not in SUPPORTED_CHAINS (bsc|mainnet|polygon|arbitrum|base)
      setupMocks({ isConnected: true, isWrongNetwork: true });
      const result = useNetworkGuard();
      expect(result.isWrongNetwork).toBe(true);
      expect(result.canOperate).toBe(false);
      expect(result.canOperateOnCore).toBe(false);
      expect(result.isDisconnected).toBe(false);
    });
  });

  describe("已连接·不支持的链（isWrongNetwork = true）", () => {
    it("canOperate = false, canOperateOnCore = false, isDisconnected = false", () => {
      setupMocks({ isConnected: true, isWrongNetwork: true });
      const result = useNetworkGuard();
      expect(result.isWrongNetwork).toBe(true);
      expect(result.canOperate).toBe(false);
      expect(result.canOperateOnCore).toBe(false);
      expect(result.isDisconnected).toBe(false);
    });

    it("switchToCore calls switchChain with BSC chainId", () => {
      setupMocks({ isConnected: true, isWrongNetwork: true });
      const result = useNetworkGuard();
      result.switchToCore();
      expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: bsc.id });
    });
  });

  describe("isOnChain / switchTo（多链切链 API）", () => {
    it("isOnChain(chainId) 匹配钱包当前链返回 true", () => {
      setupMocks({ isConnected: true, isWrongNetwork: false, chain: arbitrum });
      const result = useNetworkGuard();
      expect(result.isOnChain(arbitrum.id)).toBe(true);
      expect(result.isOnChain(bsc.id)).toBe(false);
    });

    it("isOnChain 在未连接态下返回 false", () => {
      setupMocks({ isConnected: false, isWrongNetwork: false });
      const result = useNetworkGuard();
      expect(result.isOnChain(bsc.id)).toBe(false);
    });

    it("switchTo(chainId) 转发任意目标链到 switchChain", () => {
      setupMocks({ isConnected: true, isWrongNetwork: false, chain: bsc });
      const result = useNetworkGuard();
      result.switchTo(arbitrum.id);
      expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: arbitrum.id });
    });
  });
});
