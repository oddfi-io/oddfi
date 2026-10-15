// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWalletConnect } from "./useWalletConnect";

// ─── Mock wagmi hooks ─────────────────────────────────────────────────────────

const mockConnect = vi.fn();
const mockReset = vi.fn();
const mockDisconnect = vi.fn();
const mockDisconnectAsync = vi.fn(() => Promise.resolve());
let mockIsPending = false;
const mockFreshAccount: { status: string; connector: { id: string } | null } = {
  status: "disconnected",
  connector: null,
};

// BUG-011: useAccount 的 isConnected 也被 useWalletConnect 订阅了（auto-close 守卫）
let mockWalletConnected = false;

vi.mock("wagmi", () => ({
  useConnect: () => ({
    connect: mockConnect,
    isPending: mockIsPending,
    reset: mockReset,
  }),
  useDisconnect: () => ({
    disconnect: mockDisconnect,
    disconnectAsync: mockDisconnectAsync,
  }),
  useConfig: () => ({
    connectors: [],
  }),
  useAccount: () => ({
    isConnected: mockWalletConnected,
  }),
}));

vi.mock("wagmi/actions", () => ({
  getAccount: () => mockFreshAccount,
}));

// ─── Mock stores ──────────────────────────────────────────────────────────────

let mockIsAuthenticated = false;
let mockRefreshToken: string | null = null;
const mockIncrementRetry = vi.fn();

const mockSetLoginError = vi.fn();
const mockResetLoginUI = vi.fn();

vi.mock("@/stores/authStore", () => {
  // BUG-006: handleWalletClick PC guard 同步读 useAuthStore.getState().refreshToken；
  // 测试需要既支持 hook selector 形式也支持 .getState() 形式。
  const useAuthStoreFn = (
    selector: (s: {
      isAuthenticated: boolean;
      setLoginError: typeof mockSetLoginError;
      resetLoginUI: typeof mockResetLoginUI;
    }) => unknown
  ) =>
    selector({
      isAuthenticated: mockIsAuthenticated,
      setLoginError: mockSetLoginError,
      resetLoginUI: mockResetLoginUI,
    });
  (useAuthStoreFn as unknown as { getState: () => unknown }).getState = () => ({
    refreshToken: mockRefreshToken,
    incrementRetry: mockIncrementRetry,
  });
  return { useAuthStore: useAuthStoreFn };
});

// ─── Mock walletConfig ────────────────────────────────────────────────────────

vi.mock("@/components/wallet/walletConfig", () => ({
  findConnector: vi.fn(() => undefined),
  findWcModalConnector: vi.fn(() => undefined),
  findWcQrConnector: vi.fn(() => undefined),
  storeConnectedWallet: vi.fn(),
  clearConnectedWallet: vi.fn(),
}));

// ─── Mock wallet-env (connector-based detection) ──────────────────────────────

vi.mock("@/lib/wallet-env", () => ({
  detectWalletEnv: vi.fn(() => ({ type: "desktop" as const })),
}));

// ─── Mock mobile-wallet-detect (deep link functions only) ─────────────────────

vi.mock("@/lib/mobile-wallet-detect", () => ({
  getWcDeepLink: vi.fn(() => null),
}));

// ─── Import mocked modules for per-test control ─────────────────────────────

import {
  findConnector,
  findWcModalConnector,
  findWcQrConnector,
} from "@/components/wallet/walletConfig";
import { detectWalletEnv } from "@/lib/wallet-env";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useWalletConnect", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIsPending = false;
    mockIsAuthenticated = false;
    mockRefreshToken = null;
    mockWalletConnected = false;
    mockFreshAccount.status = "disconnected";
    mockFreshAccount.connector = null;
    mockDisconnectAsync.mockClear();
    mockDisconnectAsync.mockReturnValue(Promise.resolve());
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("returns select view and no connecting wallet by default", () => {
      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));
      expect(result.current.view).toBe("select");
      expect(result.current.connectingId).toBeNull();
      expect(result.current.wcDeepLink).toBeNull();
    });
  });

  describe("reset on close (0.4 改动 4)", () => {
    it("calls reset() when modal closes to clear stale isPending", () => {
      const { rerender } = renderHook(
        ({ open }) => useWalletConnect({ open, onClose: mockOnClose }),
        { initialProps: { open: true } }
      );

      // Close the modal
      rerender({ open: false });

      // Advance past the 300ms animation delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockReset).toHaveBeenCalled();
    });

    it("resets view and connectingId after close animation delay", () => {
      const { result, rerender } = renderHook(
        ({ open }) => useWalletConnect({ open, onClose: mockOnClose }),
        { initialProps: { open: true } }
      );

      // Close the modal
      rerender({ open: false });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.view).toBe("select");
      expect(result.current.connectingId).toBeNull();
      expect(result.current.wcDeepLink).toBeNull();
    });
  });

  describe("reset before new connection (0.4 改动 5)", () => {
    it("calls reset() at the beginning of handleWalletClick", () => {
      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("metamask");
      });

      // reset should be called before any connection attempt
      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe("isPending reflects wagmi state", () => {
    it("returns isPending=false when wagmi is idle", () => {
      mockIsPending = false;
      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));
      expect(result.current.isPending).toBe(false);
    });

    it("returns isPending=true when wagmi is pending", () => {
      mockIsPending = true;
      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));
      expect(result.current.isPending).toBe(true);
    });
  });

  // ── handleWalletClick PC path ─────────────────────────────────────────────

  describe("handleWalletClick PC path", () => {
    it("calls findConnector and connect for desktop environment", () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      const mockConnector = { id: "metaMask", name: "MetaMask" };
      vi.mocked(findConnector).mockReturnValue(mockConnector as never);

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("metamask");
      });

      expect(findConnector).toHaveBeenCalledWith("metamask", []);
      expect(mockConnect).toHaveBeenCalledWith(
        { connector: mockConnector },
        expect.objectContaining({
          onError: expect.any(Function),
          onSettled: expect.any(Function),
        })
      );
      expect(result.current.view).toBe("signing");
      expect(result.current.connectingId).toBe("metamask");
    });

    it("does not call connect when connector is not found on PC", () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      vi.mocked(findConnector).mockReturnValue(undefined);

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("metamask");
      });

      expect(mockConnect).not.toHaveBeenCalled();
      // View stays on select since beginConnect is not called
      expect(result.current.view).toBe("select");
    });
  });

  // ── handleWalletClick WC modal path ───────────────────────────────────────

  describe("handleWalletClick WC modal path", () => {
    it("uses findWcModalConnector for walletconnect on external-browser", () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "external-browser" });
      const mockWcModal = { id: "walletConnect", name: "WalletConnect" };
      vi.mocked(findWcModalConnector).mockReturnValue(mockWcModal as never);

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("walletconnect");
      });

      expect(findWcModalConnector).toHaveBeenCalledWith([]);
      expect(mockConnect).toHaveBeenCalledWith(
        { connector: mockWcModal },
        expect.objectContaining({
          onError: expect.any(Function),
          onSettled: expect.any(Function),
        })
      );
      expect(result.current.connectingId).toBe("walletconnect");
    });
  });

  // ── handleWalletClick H5 deep link path ───────────────────────────────────

  describe("handleWalletClick H5 deep link path", () => {
    it("uses connectViaWcProtocol for named wallet on external-browser", async () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "external-browser" });
      const mockProvider = {
        once: vi.fn(),
      };
      const mockWcQr = {
        id: "walletConnect",
        name: "WalletConnect",
        getProvider: vi.fn().mockResolvedValue(mockProvider),
      };
      vi.mocked(findWcQrConnector).mockReturnValue(mockWcQr as never);

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      await act(async () => {
        result.current.handleWalletClick("metamask");
      });

      expect(findWcQrConnector).toHaveBeenCalledWith([]);
      expect(mockConnect).toHaveBeenCalledWith(
        { connector: mockWcQr },
        expect.objectContaining({
          onError: expect.any(Function),
          onSettled: expect.any(Function),
        })
      );
      // Should write SELECTED_WALLET_KEY for useAuth to read
      expect(sessionStorage.getItem("oddfi_selected_wallet")).toBe("metamask");
      expect(result.current.connectingId).toBe("metamask");
    });
  });

  // ── PC WC Modal fallback (B4 fix) ──────────────────────────────────────────

  describe("PC no-extension download redirect", () => {
    it("opens download page when findConnector returns a walletConnect-type connector for known wallet", () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      // findConnector returns a WC-backed connector (extension not installed)
      const wcBackedConnector = { id: "binance", name: "Binance", type: "walletConnect" };
      vi.mocked(findConnector).mockReturnValue(wcBackedConnector as never);

      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("binance");
      });

      // Should open download page, not connect
      expect(openSpy).toHaveBeenCalledWith(
        "https://www.bnbchain.org/en/binance-wallet",
        "_blank",
        "noopener,noreferrer"
      );
      expect(mockConnect).not.toHaveBeenCalled();
      expect(result.current.connectingId).toBeNull();

      openSpy.mockRestore();
    });

    it("connects directly when findConnector returns an injected connector (extension installed)", () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      const injectedConnector = { id: "binance", name: "Binance", type: "injected" };
      vi.mocked(findConnector).mockReturnValue(injectedConnector as never);

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("binance");
      });

      // Should use injected connector directly, NOT WC Modal
      expect(findWcModalConnector).not.toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalledWith(
        { connector: injectedConnector },
        expect.objectContaining({
          onError: expect.any(Function),
          onSettled: expect.any(Function),
        })
      );
    });

    it("does not redirect walletconnect entry to WC Modal (walletId=walletconnect excluded)", () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      // walletconnect entry itself returns a WC connector
      const wcConnector = { id: "walletConnect", name: "WalletConnect", type: "walletConnect" };
      vi.mocked(findConnector).mockReturnValue(wcConnector as never);

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("walletconnect");
      });

      // Should connect directly with the WC connector (not redirected to modal)
      expect(mockConnect).toHaveBeenCalledWith(
        { connector: wcConnector },
        expect.objectContaining({
          onError: expect.any(Function),
          onSettled: expect.any(Function),
        })
      );
    });
  });

  // ── Connection timeout ────────────────────────────────────────────────────

  describe("connection timeout", () => {
    it("resets connectingId after 30s timeout on PC path", () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      const mockConnector = { id: "metaMask", name: "MetaMask" };
      vi.mocked(findConnector).mockReturnValue(mockConnector as never);

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("metamask");
      });

      expect(result.current.connectingId).toBe("metamask");

      // Advance past the 30s timeout
      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.connectingId).toBeNull();
    });
  });

  // ── Auth success auto-close ───────────────────────────────────────────────

  describe("authentication success auto-close", () => {
    it("does not call onClose when isAuthenticated is false", () => {
      mockIsAuthenticated = false;
      renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("calls onClose when isAuthenticated + walletConnected + modal open", () => {
      mockIsAuthenticated = true;
      mockWalletConnected = true;
      renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("does not call onClose when isAuthenticated is true but modal is closed", () => {
      mockIsAuthenticated = true;
      mockWalletConnected = true;
      renderHook(() => useWalletConnect({ open: false, onClose: mockOnClose }));
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    // BUG-011: logout/refresh race 后 isAuthenticated=true 但钱包已断开。
    // 用户重新点连接钱包不能被 effect 立即关掉。
    it("does NOT auto-close when isAuthenticated=true but wallet is disconnected (BUG-011)", () => {
      mockIsAuthenticated = true;
      mockWalletConnected = false;
      renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  // ── sessionStorage flag writing ───────────────────────────────────────────

  describe("sessionStorage flag writing", () => {
    it("writes EXPLICIT_CONNECT_KEY on handleWalletClick (PC path)", () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      const mockConnector = { id: "metaMask", name: "MetaMask" };
      vi.mocked(findConnector).mockReturnValue(mockConnector as never);

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("metamask");
      });

      expect(sessionStorage.getItem("oddfi_explicit_connect")).toBe("1");
    });

    it("writes EXPLICIT_CONNECT_KEY on handleWalletClick (WC modal path)", () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "external-browser" });
      const mockWcModal = { id: "walletConnect", name: "WalletConnect" };
      vi.mocked(findWcModalConnector).mockReturnValue(mockWcModal as never);

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("walletconnect");
      });

      expect(sessionStorage.getItem("oddfi_explicit_connect")).toBe("1");
    });

    it("writes both EXPLICIT_CONNECT_KEY and SELECTED_WALLET_KEY on H5 deep link path", async () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "external-browser" });
      const mockProvider = { once: vi.fn() };
      const mockWcQr = {
        id: "walletConnect",
        name: "WalletConnect",
        getProvider: vi.fn().mockResolvedValue(mockProvider),
      };
      vi.mocked(findWcQrConnector).mockReturnValue(mockWcQr as never);

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      await act(async () => {
        result.current.handleWalletClick("okx");
      });

      expect(sessionStorage.getItem("oddfi_explicit_connect")).toBe("1");
      expect(sessionStorage.getItem("oddfi_selected_wallet")).toBe("okx");
    });
  });

  // ── BUG-006: wagmi reconnecting 状态修复 ────────────────────────────────────
  // 现象：清空 oddfi_auth + 刷新 → wagmi reconnectOnMount 让 status 卡在
  // "reconnecting"，旧代码的 guard 与 disconnect 都只识别 "connected" → 直接调
  // connect() → wagmi/core/connect.js L12-13 抛 ConnectorAlreadyConnectedError
  // → onError → UI 闪一下，MetaMask 弹窗永远不出现。
  // 修法：把 reconnecting 视为 connected 等效状态，且必须 await disconnectAsync
  // 让 wagmi state 收敛后再 connect。
  describe("BUG-006 reconnecting status handling", () => {
    it("guard hits incrementRetry when status=reconnecting + same connector + has refreshToken", () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      const mockConnector = { id: "metaMaskSDK", name: "MetaMask", type: "injected" };
      vi.mocked(findConnector).mockReturnValue(mockConnector as never);
      mockFreshAccount.status = "reconnecting";
      mockFreshAccount.connector = { id: "metaMaskSDK" };
      mockRefreshToken = "valid-refresh-token";

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("metamask");
      });

      // 命中 guard → 走 incrementRetry，不调 disconnectAsync 不调 connect
      expect(mockIncrementRetry).toHaveBeenCalledOnce();
      expect(mockDisconnectAsync).not.toHaveBeenCalled();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("awaits disconnectAsync before connect when status=reconnecting + same connector + no refreshToken", async () => {
      vi.useRealTimers(); // 这条测需要真实 microtask 推进
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      const mockConnector = { id: "metaMaskSDK", name: "MetaMask", type: "injected" };
      vi.mocked(findConnector).mockReturnValue(mockConnector as never);
      mockFreshAccount.status = "reconnecting";
      mockFreshAccount.connector = { id: "metaMaskSDK" };
      mockRefreshToken = null; // session 已清空

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      await act(async () => {
        result.current.handleWalletClick("metamask");
      });

      // 必须先 await disconnectAsync 让 wagmi state 收敛，再 connect
      // BUG-010: disconnect 与 connect 之间有 100ms 等待，waitFor 等异步推进
      expect(mockDisconnectAsync).toHaveBeenCalledOnce();
      await waitFor(() =>
        expect(mockConnect).toHaveBeenCalledWith(
          { connector: mockConnector },
          expect.objectContaining({
            onError: expect.any(Function),
            onSettled: expect.any(Function),
          })
        )
      );
      // 顺序断言：disconnectAsync 必须在 connect 之前调用
      const disconnectOrder = mockDisconnectAsync.mock.invocationCallOrder[0];
      const connectOrder = mockConnect.mock.invocationCallOrder[0];
      expect(disconnectOrder).toBeLessThan(connectOrder);
    });

    it("awaits disconnectAsync before connect when status=connected + different connector", async () => {
      vi.useRealTimers();
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      const mockConnector = { id: "metaMaskSDK", name: "MetaMask", type: "injected" };
      vi.mocked(findConnector).mockReturnValue(mockConnector as never);
      mockFreshAccount.status = "connected";
      mockFreshAccount.connector = { id: "okxWallet" }; // 不同 connector
      mockRefreshToken = null;

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      await act(async () => {
        result.current.handleWalletClick("metamask");
      });

      expect(mockDisconnectAsync).toHaveBeenCalledOnce();
      await waitFor(() => expect(mockConnect).toHaveBeenCalled());
      const disconnectOrder = mockDisconnectAsync.mock.invocationCallOrder[0];
      const connectOrder = mockConnect.mock.invocationCallOrder[0];
      expect(disconnectOrder).toBeLessThan(connectOrder);
    });

    it("skips disconnectAsync when status=disconnected (initial connect path)", () => {
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      const mockConnector = { id: "metaMaskSDK", name: "MetaMask", type: "injected" };
      vi.mocked(findConnector).mockReturnValue(mockConnector as never);
      mockFreshAccount.status = "disconnected";
      mockFreshAccount.connector = null;

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      act(() => {
        result.current.handleWalletClick("metamask");
      });

      // 首次连接路径：不调 disconnectAsync，直接 connect
      expect(mockDisconnectAsync).not.toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
    });

    it("does NOT hit guard when status=reconnecting + DIFFERENT connector", async () => {
      vi.useRealTimers();
      vi.mocked(detectWalletEnv).mockReturnValue({ type: "desktop" });
      const mockConnector = { id: "metaMaskSDK", name: "MetaMask", type: "injected" };
      vi.mocked(findConnector).mockReturnValue(mockConnector as never);
      mockFreshAccount.status = "reconnecting";
      mockFreshAccount.connector = { id: "okxWallet" }; // 不同 connector
      mockRefreshToken = "valid-refresh-token"; // 即使有 refreshToken，因为 connector 不同也不能命中 guard

      const { result } = renderHook(() => useWalletConnect({ open: true, onClose: mockOnClose }));

      await act(async () => {
        result.current.handleWalletClick("metamask");
      });

      // 不命中 guard → 走 disconnect+connect 路径
      expect(mockIncrementRetry).not.toHaveBeenCalled();
      expect(mockDisconnectAsync).toHaveBeenCalledOnce();
      // BUG-010: disconnect 与 connect 之间有 100ms 等待，waitFor 等异步推进
      await waitFor(() => expect(mockConnect).toHaveBeenCalled());
    });
  });
});
