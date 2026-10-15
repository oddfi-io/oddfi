// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { WalletConnectButton } from "./ConnectButton";
import type { useNetworkGuard as UseNetworkGuardType } from "@/hooks/useNetworkGuard";

const mockSwitchToCore = vi.fn();
const mockOpenConnectModal = vi.fn();

// Mock useNetworkGuard
vi.mock("@/hooks/useNetworkGuard", () => ({
  useNetworkGuard: vi.fn(),
}));

// Mock useDepositFlow
vi.mock("@/hooks/useDepositFlow", () => ({
  useDepositFlow: vi.fn(() => ({
    state: {
      isOpen: false,
      step: 1,
      selectedAsset: null,
      usdAmount: "",
      txResult: null,
    },
    open: vi.fn(),
    close: vi.fn(),
    goNext: vi.fn(),
    goBack: vi.fn(),
    setStep: vi.fn(),
    selectAsset: vi.fn(),
    setUsdAmount: vi.fn(),
    setTxResult: vi.fn(),
  })),
}));

// Mock WalletConnectModal
vi.mock("./WalletConnectModal", () => ({
  WalletConnectModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? React.createElement("div", { "data-testid": "wallet-connect-modal" }) : null,
}));

// Mock MobileWalletConnectSheet (uses wagmi hooks internally)
vi.mock("./MobileWalletConnectSheet", () => ({
  MobileWalletConnectSheet: ({ open }: { open: boolean }) =>
    open ? React.createElement("div", { "data-testid": "mobile-wallet-sheet" }) : null,
}));

// Mock DepositModal
vi.mock("@/components/deposit/DepositModal", () => ({
  DepositModal: () => null,
}));

// Mock useDappBrowserConnect (wagmi hooks not available in test)
const mockConnectDapp = vi.fn(() => false);
vi.mock("@/hooks/useWalletConnect", () => ({
  useDappBrowserConnect: () => ({ connectDapp: mockConnectDapp }),
}));

// Mock detectWalletEnv — default to desktop (no dApp browser interception)
vi.mock("@/lib/wallet-env", () => ({
  detectWalletEnv: () => ({ type: "desktop" as const }),
}));

// Mock wagmi useConfig + useAccount + useConnect
let mockWalletStatus: "connected" | "disconnected" | "connecting" = "disconnected";
let mockWalletAddress: string | undefined = undefined;
let mockRecentConnectorId: string | null = null;
const mockConnectors: Array<{ id: string }> = [];
const mockConnectAsync = vi.fn<(args: { connector: unknown }) => Promise<unknown>>(() =>
  Promise.resolve({})
);
const mockStorageGetItem = vi.fn<(key: string) => unknown>(() =>
  Promise.resolve(mockRecentConnectorId)
);
vi.mock("wagmi", () => ({
  useConfig: () => ({
    connectors: mockConnectors,
    storage: { getItem: mockStorageGetItem },
  }),
  useAccount: () => ({ status: mockWalletStatus, address: mockWalletAddress }),
  useConnect: () => ({ connectAsync: mockConnectAsync }),
}));

// Mock useIsPhone
let mockIsPhone = false;
vi.mock("@/hooks/useIsPhone", () => ({
  useIsPhone: () => mockIsPhone,
}));

// Mock truncateAddress（来自 walletConfig）
vi.mock("./walletConfig", () => ({
  truncateAddress: (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`,
  WALLETS: [],
  clearConnectedWallet: vi.fn(),
}));

// Mock useAuth（导出所有常量）
vi.mock("@/hooks/useAuth", () => ({
  EXPLICIT_CONNECT_KEY: "oddfi_explicit_connect",
  EXPLICIT_CONNECT_TS_KEY: "oddfi_explicit_connect_ts",
  LAST_CONNECTOR_ID_KEY: "oddfi_last_connector_id",
}));

// Mock authStore — Round 5 2 态
let mockAuthUIState: "connect" | "ready" = "connect";

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) => selector({}),
  useAuthUIState: () => mockAuthUIState,
}));

// Mock ConnectButton.Custom + useConnectModal
const mockRainbowOpenConnectModal = vi.fn();
let mockRainbowAccount: unknown = null;
let mockRainbowChain: unknown = null;

vi.mock("@rainbow-me/rainbowkit", () => ({
  ConnectButton: {
    Custom: ({
      children,
    }: {
      children: (args: {
        account: unknown;
        chain: unknown;
        openConnectModal: () => void;
        mounted: boolean;
      }) => React.ReactNode;
    }) =>
      children({
        account: mockRainbowAccount,
        chain: mockRainbowChain,
        openConnectModal: mockRainbowOpenConnectModal,
        mounted: true,
      }),
  },
  useConnectModal: () => ({
    openConnectModal: mockRainbowOpenConnectModal,
  }),
}));

import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import React from "react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";

function setupGuard(overrides: Partial<ReturnType<typeof UseNetworkGuardType>>) {
  vi.mocked(useNetworkGuard).mockReturnValue({
    canOperate: false,
    canOperateOnCore: false,
    isOnCoreChain: false,
    isWrongNetwork: false,
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
    currentChain: undefined,
    coreChain: { id: 56 } as ReturnType<typeof UseNetworkGuardType>["coreChain"],
    isOnChain: () => false,
    switchTo: vi.fn(),
    switchToCore: mockSwitchToCore,
    isSwitching: false,
    switchError: null,
    connect: vi.fn(),
    ...overrides,
  } as ReturnType<typeof UseNetworkGuardType>);
}

function renderButton() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WalletConnectButton />
    </NextIntlClientProvider>
  );
}

describe("WalletConnectButton", () => {
  beforeEach(() => {
    mockSwitchToCore.mockReset();
    mockOpenConnectModal.mockReset();
    mockRainbowOpenConnectModal.mockReset();
    mockConnectAsync.mockReset();
    mockConnectAsync.mockResolvedValue({});
    mockStorageGetItem.mockReset();
    mockStorageGetItem.mockImplementation(() => Promise.resolve(mockRecentConnectorId));
    mockRecentConnectorId = null;
    mockConnectors.length = 0;
    mockRainbowAccount = null;
    mockRainbowChain = null;
    mockIsPhone = false;
    mockWalletStatus = "disconnected";
    mockWalletAddress = undefined;
    mockAuthUIState = "connect";
    setupGuard({ isDisconnected: true, isWrongNetwork: false });
  });

  afterEach(cleanup);

  // ─── 错误链态（优先级高于登录态）────────────────────────────────────────
  describe("错误链态", () => {
    beforeEach(() => {
      mockRainbowAccount = { address: "0xabcdef1234567890" };
      mockRainbowChain = { id: 1, name: "Ethereum", unsupported: true };
    });

    it("显示 Wrong Network 按钮", () => {
      setupGuard({ isWrongNetwork: true, isDisconnected: false });
      renderButton();
      expect(screen.getByText("Wrong Network")).toBeTruthy();
    });

    it("切链中显示 Switching... 且按钮 disabled", () => {
      setupGuard({ isWrongNetwork: true, isSwitching: true, isDisconnected: false });
      renderButton();
      const btn = screen.getByRole("button");
      expect(btn.textContent).toBe("Switching...");
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it("点击调用 switchToCore", () => {
      setupGuard({ isWrongNetwork: true, isDisconnected: false });
      renderButton();
      fireEvent.click(screen.getByRole("button"));
      expect(mockSwitchToCore).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 状态 1: connect（wallet=no, session=no）────────────────────────────
  describe("状态 1 — connect", () => {
    beforeEach(() => {
      mockAuthUIState = "connect";
      mockWalletStatus = "disconnected";
    });

    it("桌面端显示 Connect Wallet 按钮", () => {
      renderButton();
      expect(screen.getByText("Connect Wallet")).toBeTruthy();
    });

    it("移动端显示短文字 Connect", () => {
      mockIsPhone = true;
      renderButton();
      expect(screen.getByText("Connect")).toBeTruthy();
    });

    it("桌面端点击打开 WalletConnectModal", () => {
      mockIsPhone = false;
      renderButton();
      expect(screen.queryByTestId("wallet-connect-modal")).toBeNull();
      fireEvent.click(screen.getByText("Connect Wallet"));
      expect(screen.getByTestId("wallet-connect-modal")).toBeTruthy();
    });

    it("移动端点击打开 MobileWalletConnectSheet", () => {
      mockIsPhone = true;
      renderButton();
      expect(screen.queryByTestId("mobile-wallet-sheet")).toBeNull();
      fireEvent.click(screen.getByText("Connect"));
      expect(screen.getByTestId("mobile-wallet-sheet")).toBeTruthy();
    });
  });

  // ─── Round 5: signin 态被折叠 → wallet=yes + session=no 仍渲染 Connect ──
  describe("Round 5: signin 折叠", () => {
    it("authUIState=connect 且 wallet=connected 时仍渲染 Connect Wallet（signin 已折叠）", () => {
      mockAuthUIState = "connect";
      mockWalletStatus = "connected";
      mockWalletAddress = "0x1234567890abcdef1234567890abcdef12345678";
      mockRainbowAccount = { address: mockWalletAddress };
      mockRainbowChain = { id: 56, name: "BNB Smart Chain", unsupported: false };
      renderButton();
      expect(screen.getByText("Connect Wallet")).toBeTruthy();
      expect(screen.queryByText("Sign In to Oddfi")).toBeNull();
      expect(screen.queryByText("登录 Oddfi")).toBeNull();
    });
  });

  // ─── 状态 2: ready（session=yes）────────────────────────────────────────
  describe("状态 2 — ready", () => {
    beforeEach(() => {
      mockAuthUIState = "ready";
      mockWalletStatus = "connected";
      mockWalletAddress = "0x1234567890abcdef1234567890abcdef12345678";
      mockRainbowAccount = { address: mockWalletAddress, displayName: "alice.eth" };
      mockRainbowChain = { id: 56, name: "BNB Smart Chain", unsupported: false };
      setupGuard({
        canOperate: true,
        isWrongNetwork: false,
        isDisconnected: false,
        isConnected: true,
      });
    });

    it("渲染 Deposit 按钮", () => {
      renderButton();
      expect(screen.getByText("Deposit")).toBeTruthy();
    });

    it("不显示 Connect Wallet", () => {
      renderButton();
      expect(screen.queryByText("Connect Wallet")).toBeNull();
    });
  });

  // ─── ENH-014: detached 态（session=yes 但 wallet=disconnected）────────────
  describe("ENH-014 detached — session 有效但 wagmi 断开", () => {
    beforeEach(() => {
      mockAuthUIState = "ready"; // session 仍有效
      mockWalletStatus = "disconnected"; // 钱包侧主动断开
      mockWalletAddress = undefined;
      mockRainbowAccount = null;
      mockRainbowChain = null;
      setupGuard({ isConnected: false, isDisconnected: true });
    });

    it("头部降级为 Connect Wallet（不显示 Deposit，避免误触发 RainbowKit modal）", () => {
      renderButton();
      expect(screen.getByText("Connect Wallet")).toBeTruthy();
      expect(screen.queryByText("Deposit")).toBeNull();
    });

    it("点击 Connect Wallet 打开连接 UI 让用户重连", () => {
      renderButton();
      fireEvent.click(screen.getByText("Connect Wallet"));
      expect(screen.getByTestId("wallet-connect-modal")).toBeTruthy();
    });
  });

  // ─── ENH-014: reconnecting 窗口（冷启动/刷新，wagmi 重连中）────────────────
  // 回归保护：避免冷启动时 Deposit → Connect Wallet → Deposit 闪烁
  describe("ENH-014 reconnecting — session 有效 + wagmi 重连中", () => {
    beforeEach(() => {
      mockAuthUIState = "ready"; // JWT 已复水
      mockWalletStatus = "connecting"; // wagmi 尚未 settle
      mockWalletAddress = undefined;
      mockRainbowAccount = null;
      mockRainbowChain = null;
      setupGuard({ isConnected: false, isConnecting: true, isDisconnected: true });
    });

    it("乐观显示 Deposit（避免 reconnect 窗口 UI 闪烁）", () => {
      renderButton();
      expect(screen.getByText("Deposit")).toBeTruthy();
      expect(screen.queryByText("Connect Wallet")).toBeNull();
    });
  });

  describe("已连接·Arbitrum（支持链·非核心链）", () => {
    beforeEach(() => {
      mockAuthUIState = "ready";
      mockWalletStatus = "connected";
      mockWalletAddress = "0x1234567890abcdef1234567890abcdef12345678";
      mockRainbowAccount = {
        address: "0x1234567890abcdef1234567890abcdef12345678",
        displayName: "alice.eth",
      };
      // Arbitrum is a supported chain — unsupported: false
      mockRainbowChain = {
        id: 42161,
        name: "Arbitrum One",
        unsupported: false,
      };
      setupGuard({
        canOperate: true,
        canOperateOnCore: false,
        isOnCoreChain: false,
        isWrongNetwork: false,
        isDisconnected: false,
        isConnected: true,
      });
    });

    it("不显示 Wrong Network 红色按钮", () => {
      render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <WalletConnectButton />
        </NextIntlClientProvider>
      );
      expect(screen.queryByText("Wrong Network")).toBeNull();
      expect(screen.queryByText("Switching...")).toBeNull();
    });

    it("不调用 switchToCore（无需切链）", () => {
      render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <WalletConnectButton />
        </NextIntlClientProvider>
      );
      expect(mockSwitchToCore).not.toHaveBeenCalled();
    });
  });
});
