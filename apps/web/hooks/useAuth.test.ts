// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuthStore } from "@/stores/authStore";

// ─── Mock wagmi hooks ─────────────────────────────────────────────────────────

const mockConnectorGetChainId = vi.fn(() => Promise.resolve(56));

let mockAccountState: {
  address: string | undefined;
  status: string;
  connector: { id: string; getChainId: () => Promise<number> } | undefined;
  chain: { id: number } | undefined;
} = {
  address: undefined,
  status: "disconnected",
  connector: undefined,
  chain: undefined,
};

const mockSignMessage = vi.fn();
// BUG-008 后续修复：catch 路径改 disconnectAsync。让两者共用同一 fn 简化断言（mock fn 返回 Promise，sync 与 async 调用均兼容）
const mockDisconnect = vi.fn(() => Promise.resolve());
const mockSwitchChain = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => mockAccountState,
  useSignMessage: () => ({ signMessageAsync: mockSignMessage }),
  useDisconnect: () => ({ disconnect: mockDisconnect, disconnectAsync: mockDisconnect }),
  useSwitchChain: () => ({ switchChainAsync: mockSwitchChain }),
  useConfig: () => ({ connectors: [] }),
}));

// ─── Mock API functions ───────────────────────────────────────────────────────

const mockStep1 = vi.fn();
const mockStep2 = vi.fn();
const mockLogout = vi.fn();
const mockGetDeposit = vi.fn();

vi.mock("@/lib/api", () => ({
  loginByWalletStep1: (...args: unknown[]) => mockStep1(...args),
  loginByWalletStep2: (...args: unknown[]) => mockStep2(...args),
  logoutApi: (...args: unknown[]) => mockLogout(...args),
  getDepositAddress: (...args: unknown[]) => mockGetDeposit(...args),
}));

// ─── Mock auth helpers ────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  buildSignMessage: vi.fn(() => "mock-sign-message"),
  mapWalletType: vi.fn(() => "metamask"),
  mapChainName: vi.fn(() => "bsc"),
  decodeJwtAddress: vi.fn(() => null),
}));

// ─── Mock chains ──────────────────────────────────────────────────────────────

vi.mock("@/lib/chains", () => ({
  isCoreChain: vi.fn(() => true),
  CORE_CHAIN: { id: 56 },
}));

// ─── Mock wallet-chain (BD-008) ───────────────────────────────────────────────

const mockEnsureCoreChain = vi.fn(() => Promise.resolve());

vi.mock("@/lib/wallet-chain", () => ({
  get ensureCoreChain() {
    return mockEnsureCoreChain;
  },
}));

// ─── Mock wallet-recovery (BUG-013) ───────────────────────────────────────────

const mockWaitForConnectorRecovery = vi.fn();

vi.mock("@/lib/wallet-recovery", () => ({
  get waitForConnectorRecovery() {
    return mockWaitForConnectorRecovery;
  },
}));

// ─── Mock wallet-env (connector-based detection) ──────────────────────────────

vi.mock("@/lib/wallet-env", () => ({
  detectWalletEnv: vi.fn(() => ({ type: "desktop" as const })),
}));

// ─── Mock Sentry (BUG-005 Fix D coverage) ─────────────────────────────────────

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// ─── Mock proxyWalletStore ────────────────────────────────────────────────────

const mockSetProxyWallet = vi.fn();
const mockClearProxy = vi.fn();
const mockSetAssignError = vi.fn();

vi.mock("@/stores/proxyWalletStore", () => ({
  useProxyWalletStore: {
    getState: () => ({
      setProxyWallet: mockSetProxyWallet,
      clearProxy: mockClearProxy,
      setAssignError: mockSetAssignError,
    }),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetAuthStore() {
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    accessTokenExpireAt: null,
    refreshTokenExpireAt: null,
    sessionAddress: null,
    isAuthenticated: false,
    isLoggingIn: false,
    loginError: null,
    retryCount: 0,
    signRequested: false,
    refreshInFlight: false,
    refreshFailed: false,
    // ENH-018: 测试默认视为 hydrate 完成（等效于 Providers useEffect 已跑完）。
    isHydrated: true,
  });
}

const STEP1_RESPONSE = {
  data: { nonce: "test-nonce-123" },
  done: false as const,
  require: ["signature"],
  session_id: "session-abc",
  step: 1 as const,
};

const STEP2_RESPONSE = {
  data: {
    access_token: { token: "access-jwt-xyz", expire_at: 9999999999 },
    refresh_token: { token: "refresh-jwt-xyz", expire_at: 9999999999 },
  },
  done: true as const,
  session_id: "session-abc",
  step: 2 as const,
};

function setConnectedWithExplicitFlag() {
  sessionStorage.setItem("oddfi_explicit_connect", "1");
  mockAccountState = {
    address: "0xAbC123",
    status: "connected",
    connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
    chain: { id: 56 },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetAuthStore();
    sessionStorage.clear();
    localStorage.clear();
    mockAccountState = {
      address: undefined,
      status: "disconnected",
      connector: undefined,
      chain: undefined,
    };
    mockStep1.mockResolvedValue(STEP1_RESPONSE);
    mockStep2.mockResolvedValue(STEP2_RESPONSE);
    mockSignMessage.mockResolvedValue("0xsig123");
    mockLogout.mockResolvedValue(undefined);
    mockGetDeposit.mockResolvedValue({ address: "0xDeposit456", chain: "bsc" });
    mockSwitchChain.mockResolvedValue({ id: 56 });
    // BD-008: clearAllMocks 会清掉 mockEnsureCoreChain 的默认实现，每次 beforeEach 需恢复
    mockEnsureCoreChain.mockResolvedValue(undefined);
    mockConnectorGetChainId.mockResolvedValue(56);
    // BUG-013: 默认 recovery 不主动恢复（避免影响既有 case）；BUG-013 case 中按需 override
    mockWaitForConnectorRecovery.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Lazy-import to pick up mocks
  async function importAndRender() {
    const { useAuth } = await import("./useAuth");
    return renderHook(() => useAuth());
  }

  // ── 1. Initial state ──────────────────────────────────────────────────────

  describe("initial state", () => {
    it("returns correct defaults when disconnected", async () => {
      const { result } = await importAndRender();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoggingIn).toBe(false);
      expect(result.current.loginError).toBeNull();
    });
  });

  // ── 2. Successful login flow ──────────────────────────────────────────────

  describe("successful login flow", () => {
    it("performs full login when explicit flag is set and wallet connects", async () => {
      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      // Let all async operations (performLogin) settle
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockStep1).toHaveBeenCalledWith(
        expect.objectContaining({
          address: "0xAbC123",
          wallet_type: "metamask",
          chain: "bsc",
        })
      );

      expect(mockSignMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: "mock-sign-message" })
      );

      expect(mockStep2).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: "session-abc",
          address: "0xAbC123",
          signature: "0xsig123",
        })
      );

      // authStore should be authenticated (real store)
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoggingIn).toBe(false);
      expect(result.current.loginError).toBeNull();
    });
  });

  // ── 3. Signature rejected ─────────────────────────────────────────────────

  // ── 2.1 钱包在错链时主动切链（DD-079 testnet 模式 latent bug 修复） ─────
  describe("wallet on unsupported chain", () => {
    it("calls ensureCoreChain regardless of current chain (BD-008 unified entry)", async () => {
      sessionStorage.setItem("oddfi_explicit_connect", "1");
      mockAccountState = {
        address: "0xAbC123",
        status: "connected",
        connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
        chain: undefined, // ← 钱包当前链不在 SUPPORTED_CHAINS 内
      };

      await importAndRender();
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // BD-008: ensureCoreChain 是统一切链入口，必须被调用（含 connector + switchChainAsync）
      expect(mockEnsureCoreChain).toHaveBeenCalledTimes(1);
      expect(mockEnsureCoreChain).toHaveBeenCalledWith(
        expect.objectContaining({ id: "metaMask" }),
        expect.any(Function),
        expect.anything()
      );
      // 切链后登录应正常推进
      expect(mockStep1).toHaveBeenCalledWith(expect.objectContaining({ chain: "bsc" }));
    });
  });

  describe("signature rejected", () => {
    it("Round 5: clears auth + disconnects when user rejects signature", async () => {
      mockSignMessage.mockRejectedValue(new Error("User rejected request"));
      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Round 5: catch → clearAuth + disconnect，UI 回落 connect 态
      expect(result.current.isLoggingIn).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // ── 3.1 ConnectorChainMismatchError（BUG-005 后续：cache vs live 失配） ────
  // 复现：MetaMask 扩展瞬时 state 漂移 → wagmi getConnectorClient 缓存 97 但
  // 实时 getChainId() 读到 56 → 抛 ConnectorChainMismatchError。
  // 现象：loginError 直接透传 wagmi 英文长串到 UI（"id: 56 does not match id: 97"）。
  // 期望：catch 检测到此错误时替换为友好文案 + 完成 disconnect，让用户能直接重连。
  describe("connector chain mismatch race", () => {
    it("does not leak raw wagmi ConnectorChainMismatchError to loginError", async () => {
      // BD-008: 新增单次 retry — 第一次 mismatch 会触发重试，第二次也 mismatch 才进 catch。
      // 两次都 reject 才能验证"retry 边界：retry 仍失败 → mapWalletError 返回 friendly 文案 + disconnect"。
      const mismatch = new Error(
        "The current chain of the connector (id: 56) does not match the connection's chain (id: 97).\nVersion: @wagmi/core@2.22.1"
      );
      mismatch.name = "ConnectorChainMismatchError";
      // 第一次：触发 retry；第二次：retry 也失败 → 进 catch
      mockSignMessage.mockRejectedValueOnce(mismatch).mockRejectedValueOnce(mismatch);
      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // 公共收敛：clearAuth + disconnect
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoggingIn).toBe(false);
      expect(mockDisconnect).toHaveBeenCalled();

      // 关键：loginError 必须是友好文案，不能透传 wagmi 内部细节
      const msg = result.current.loginError ?? "";
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toMatch(/does not match/i);
      expect(msg).not.toMatch(/Version: @wagmi/i);
      expect(msg).not.toMatch(/connector \(id:/i);

      // BD-008: sign 被调用 2 次（1 次原始 + 1 次 retry）
      expect(mockSignMessage).toHaveBeenCalledTimes(2);
    });
  });

  // ── 3.2 ConnectorNotConnectedError（BUG-013 多扩展 provider contention） ────
  // 复现：装多个钱包扩展（MetaMask + Yoroi/TON/TRON 等）→ window.ethereum 被污染 →
  // metaMaskSDK 拿到污染 provider → emit disconnect → wagmi state.current 清空 →
  // signMessage 拿不到 connection 抛 ConnectorNotConnectedError。
  describe("connector not connected race (BUG-013)", () => {
    it("retries once after waitForConnectorRecovery returns true (recovery 成功)", async () => {
      const notConnected = Object.assign(new Error("Connector not connected."), {
        name: "ConnectorNotConnectedError",
      });
      // 第一次：抛 NotConnected → 触发 recovery；recovery 返回 true → 重试成功
      mockSignMessage.mockRejectedValueOnce(notConnected).mockResolvedValueOnce("0xsig-retry");
      mockWaitForConnectorRecovery.mockResolvedValueOnce(true);

      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // recovery 被调用一次，超时窗口 1.5s
      expect(mockWaitForConnectorRecovery).toHaveBeenCalledWith(expect.anything(), 1500);
      // sign 被调用 2 次（原始 + retry）
      expect(mockSignMessage).toHaveBeenCalledTimes(2);
      // 登录成功
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.loginError).toBeNull();
    });

    it("throws original error when waitForConnectorRecovery times out (state 未自愈不掩盖)", async () => {
      const notConnected = Object.assign(new Error("Connector not connected."), {
        name: "ConnectorNotConnectedError",
      });
      mockSignMessage.mockRejectedValue(notConnected);
      mockWaitForConnectorRecovery.mockResolvedValueOnce(false); // recovery 超时

      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // recovery 被调用一次 → 超时返回 false → 不重试 sign，原 error 透传
      expect(mockWaitForConnectorRecovery).toHaveBeenCalledTimes(1);
      expect(mockSignMessage).toHaveBeenCalledTimes(1);
      // 登录失败，clearAuth + disconnect
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockDisconnect).toHaveBeenCalled();
      // loginError 是 friendly 文案（mapWalletError 映射后），不是 raw wagmi 消息
      expect(result.current.loginError).toBe("Wallet connection lost — please try again");
    });

    it("does not retry a second time even if NotConnected persists (signRetried 单次)", async () => {
      const notConnected = Object.assign(new Error("Connector not connected."), {
        name: "ConnectorNotConnectedError",
      });
      // 第一次：触发 retry；recovery 返回 true；第二次仍抛 NotConnected → 不再重试
      mockSignMessage.mockRejectedValueOnce(notConnected).mockRejectedValueOnce(notConnected);
      mockWaitForConnectorRecovery.mockResolvedValueOnce(true);

      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // sign 被调用恰好 2 次（不会第 3 次），recovery 仅一次
      expect(mockSignMessage).toHaveBeenCalledTimes(2);
      expect(mockWaitForConnectorRecovery).toHaveBeenCalledTimes(1);
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // ── 4. Signature timeout ──────────────────────────────────────────────────

  describe("signature timeout", () => {
    it("Round 5: clears auth + disconnects after 30s signature timeout", async () => {
      // signMessageAsync never resolves
      mockSignMessage.mockReturnValue(new Promise(() => {}));
      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      // Advance past the 30s timeout
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });

      expect(result.current.isLoggingIn).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // ── 5. Retry via incrementRetry ───────────────────────────────────────────

  describe("retry", () => {
    it("re-triggers performLogin when retryCount increments", async () => {
      // Start with connected wallet and explicit flag, but step1 fails initially
      mockStep1.mockRejectedValueOnce(new Error("Network error"));
      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Round 5: 失败 → clearAuth + disconnect（loginError 在 clearAuth 中被重置）
      expect(mockStep1).toHaveBeenCalledTimes(1);
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockDisconnect).toHaveBeenCalled();

      // Fix mock and retry
      mockStep1.mockResolvedValue(STEP1_RESPONSE);

      act(() => {
        result.current.retry();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockStep1).toHaveBeenCalledTimes(2);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.loginError).toBeNull();
    });
  });

  // ── 6. Disconnect → DD-072 4 态下不再强制登出 ─────────────────────────────
  //
  // DD-072：钱包断开仅降级 UI 到状态 3 "reconnect"，session 由 refreshToken 维持。
  // 仅当 NEXT_PUBLIC_AUTH_4STATE=false（回滚路径）时才执行 performLogout。

  describe("wallet disconnect (DD-072 4 态默认不登出)", () => {
    it("keeps session when wallet disconnects (state 3 reconnect)", async () => {
      setConnectedWithExplicitFlag();
      const { result, rerender } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(result.current.isAuthenticated).toBe(true);

      mockAccountState = {
        address: undefined,
        status: "disconnected",
        connector: undefined,
        chain: undefined,
      };
      rerender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // DD-072：不再调用 logoutApi / clearAuth，session 保留
      expect(mockLogout).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  // ── 7. Round 5: signin 折叠 → wallet 连 + 无 session 时强制 disconnect ────

  describe("Round 5: force-disconnect on wallet=yes + session=no", () => {
    it("calls disconnect when wallet connected without session and no explicit flag", async () => {
      mockAccountState = {
        address: "0xAbC123",
        status: "connected",
        connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
        chain: { id: 56 },
      };

      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Round 5: Effect 2 (f) 汇聚点强制 disconnect，UI 回落 connect 态
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // ── 8. Silent reconnect (DD-072 Round 5) ──────────────────────────────────
  //
  // Round 5：钱包 silent reconnect 无 session 时不再保留 signin 中间态，
  // 而由 Effect 2 (f) 直接 disconnect。详见 section 7 测试。
  // 此处只覆盖不自动发起签名（避免跳过用户确认）。

  describe("silent reconnect (DD-072 Round 5)", () => {
    it("does not auto-trigger signature when wallet connects without explicit flag", async () => {
      mockAccountState = {
        address: "0xAbC123",
        status: "connected",
        connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
        chain: { id: 56 },
      };

      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockStep1).not.toHaveBeenCalled();
    });
  });

  // ── 9. Deposit address fetched on auth ────────────────────────────────────

  describe("deposit address fetched after authentication", () => {
    it("calls getDepositAddress when isAuthenticated becomes true", async () => {
      setConnectedWithExplicitFlag();
      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockGetDeposit).toHaveBeenCalled();
      expect(mockSetProxyWallet).toHaveBeenCalledWith({
        address: "0xDeposit456",
        network: "BNB Smart Chain",
        chainId: 56,
      });
    });

    it("sets assign error when deposit address stays empty（重试 3 次耗尽后）", async () => {
      mockGetDeposit.mockResolvedValue({ address: "", chain: "bsc" });
      setConnectedWithExplicitFlag();
      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // 首发 + 2 次退避重试全部空地址 → 才落 assignError（REV M-1 固化调用次数契约）
      expect(mockGetDeposit).toHaveBeenCalledTimes(3);
      expect(mockSetAssignError).toHaveBeenCalledWith(
        expect.stringContaining("Deposit address unavailable")
      );
    });

    it("sets assign error when getDepositAddress keeps failing（重试 3 次耗尽后）", async () => {
      mockGetDeposit.mockRejectedValue(new Error("Server error"));
      setConnectedWithExplicitFlag();
      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // 首发 + 2 次退避重试全部失败 → 才落 assignError（REV M-1 固化调用次数契约）
      expect(mockGetDeposit).toHaveBeenCalledTimes(3);
      expect(mockSetAssignError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load deposit address")
      );
    });

    // Magic not-ready 兜底重试：空地址/失败先退避重试（1.5s/3s），恢复后不落 assignError
    it("empty address 首次 → 重试成功 setProxyWallet，且不设 assignError", async () => {
      mockGetDeposit
        .mockResolvedValueOnce({ address: "", chain: "bsc" })
        .mockResolvedValueOnce({ address: "0xDeposit456", chain: "bsc" });
      setConnectedWithExplicitFlag();
      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockGetDeposit).toHaveBeenCalledTimes(2);
      expect(mockSetProxyWallet).toHaveBeenCalledWith({
        address: "0xDeposit456",
        network: "BNB Smart Chain",
        chainId: 56,
      });
      expect(mockSetAssignError).not.toHaveBeenCalled();
    });

    it("持续失败 → 共尝试 3 次（首发 + 2 次重试）后才落 assignError", async () => {
      mockGetDeposit.mockRejectedValue(new Error("magic deposit address not ready"));
      setConnectedWithExplicitFlag();
      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockGetDeposit).toHaveBeenCalledTimes(3);
      expect(mockSetAssignError).toHaveBeenCalledTimes(1);
      expect(mockSetAssignError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load deposit address")
      );
    });
  });

  // ── Additional edge cases ─────────────────────────────────────────────────

  describe("logout function", () => {
    it("calls logoutApi and clears auth + proxy", async () => {
      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(result.current.isAuthenticated).toBe(true);

      await act(async () => {
        await result.current.logout();
      });

      expect(mockLogout).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockClearProxy).toHaveBeenCalled();
    });

    it("clears auth even if logoutApi fails (best effort)", async () => {
      mockLogout.mockRejectedValue(new Error("Network error"));
      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(mockClearProxy).toHaveBeenCalled();
    });

    // DD-072 Round 4：wagmi useDisconnect onSuccess 通过模块级 triggerGlobalLogout 级联到 performLogout
    it("triggerGlobalLogout (called by useWallet) invokes full logout when useAuth is mounted", async () => {
      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(result.current.isAuthenticated).toBe(true);

      const { triggerGlobalLogout } = await import("./useAuth");
      await act(async () => {
        await triggerGlobalLogout();
      });

      expect(mockLogout).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockClearProxy).toHaveBeenCalled();
    });

    // logout 保留 LAST_CONNECTOR_ID_KEY：用户回到登录窗时给上次用过的钱包加「Last used」tag
    it("logout preserves LAST_CONNECTOR_ID_KEY in localStorage", async () => {
      setConnectedWithExplicitFlag();
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });
      // performLogin 成功后写入 connector id
      expect(localStorage.getItem("oddfi_last_connector_id")).toBe("metaMask");

      await act(async () => {
        await result.current.logout();
      });

      // 跨 logout 持久化，下次成功登录其他钱包时才会被覆盖
      expect(localStorage.getItem("oddfi_last_connector_id")).toBe("metaMask");
    });
  });

  describe("SELECTED_WALLET_KEY from sessionStorage", () => {
    it("reads and clears SELECTED_WALLET_KEY during login", async () => {
      sessionStorage.setItem("oddfi_explicit_connect", "1");
      sessionStorage.setItem("oddfi_selected_wallet", "okx");

      mockAccountState = {
        address: "0xAbC123",
        status: "connected",
        connector: { id: "walletConnect", getChainId: mockConnectorGetChainId },
        chain: { id: 56 },
      };

      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // The wallet_type should be "okx" from sessionStorage, not "walletconnect"
      expect(mockStep1).toHaveBeenCalledWith(expect.objectContaining({ wallet_type: "okx" }));

      // sessionStorage key should be consumed
      expect(sessionStorage.getItem("oddfi_selected_wallet")).toBeNull();
    });
  });

  // ── 10. Address switch → 自动重登（DD-131）────────────────────────────────
  //
  // 钱包切换到与 session 不同的地址时：清空旧 session（clearAuth）+ **立即用新账户
  // performLogin**（签名 + 后端鉴权），不 disconnect。用户在 EOA 钱包点「连接」即手势，
  // 前端响应该信号自动重登。失败 / 拒签由 performLogin catch 收敛到 disconnect。

  describe("address switch → auto re-login (DD-131)", () => {
    // 辅助函数：预置一个已认证 session，绑定 sessionAddress
    function setAuthenticatedSession(sessionAddress: string) {
      useAuthStore.setState({
        accessToken: "access-jwt-xyz",
        refreshToken: "refresh-jwt-xyz",
        accessTokenExpireAt: 9999999999,
        refreshTokenExpireAt: 9999999999,
        sessionAddress,
        isAuthenticated: true,
        isLoggingIn: false,
        loginError: null,
        retryCount: 0,
        signRequested: false,
        refreshInFlight: false,
        refreshFailed: false,
      });
    }

    it("(a) DD-131: clears old session then auto re-logins the new account (sign + auth), no disconnect", async () => {
      // 预置 session 绑定 0xAAA
      setAuthenticatedSession("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

      // 钱包连接为 0xBBB（不同地址）
      mockAccountState = {
        address: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        status: "connected",
        connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
        chain: { id: 56 },
      };

      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // 自动用新账户重登：step1 用新地址、触发签名
      expect(mockStep1).toHaveBeenCalledWith(
        expect.objectContaining({ address: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" })
      );
      expect(mockSignMessage).toHaveBeenCalled();
      // 重登成功 → 以新账户登录态，session 切到新地址
      expect(result.current.isAuthenticated).toBe(true);
      expect(useAuthStore.getState().sessionAddress).toBe(
        "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
      );
      // 不 disconnect（保持钱包连接直接重登）
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it("(b) does NOT clear session when same address with different casing reconnects", async () => {
      // 预置 session 绑定小写地址
      setAuthenticatedSession("0xaabbccddee000000000000000000000000000001");

      // 钱包连接为大写（Checksum 格式），本质是同一地址
      mockAccountState = {
        address: "0xAABBCCDDEE000000000000000000000000000001",
        status: "connected",
        connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
        chain: { id: 56 },
      };

      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // 同一地址，不应清空 session
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it("(c) falls back to decodeJwtAddress when sessionAddress is null", async () => {
      const { decodeJwtAddress } = await import("@/lib/auth");

      // 无 sessionAddress，但 accessToken 中含有地址信息
      useAuthStore.setState({
        accessToken: "access-jwt-xyz",
        refreshToken: "refresh-jwt-xyz",
        accessTokenExpireAt: 9999999999,
        refreshTokenExpireAt: 9999999999,
        sessionAddress: null, // 无 sessionAddress → 触发 decodeJwtAddress fallback
        isAuthenticated: true,
        isLoggingIn: false,
        loginError: null,
        retryCount: 0,
        signRequested: false,
        refreshInFlight: false,
        refreshFailed: false,
      });

      // decodeJwtAddress 从 accessToken 中解出 0xAAA
      vi.mocked(decodeJwtAddress).mockReturnValue("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

      // 钱包连接为 0xBBB（不同地址）
      mockAccountState = {
        address: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        status: "connected",
        connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
        chain: { id: 56 },
      };

      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // fallback（用 JWT 解出的旧地址比对）同样触发自动重登新账户
      expect(mockStep1).toHaveBeenCalledWith(
        expect.objectContaining({ address: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" })
      );
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it("(d) Round 5: disconnects when wallet connects without session (no address to compare)", async () => {
      // 仅有 refreshToken，sessionAddress=null，refreshInFlight=false
      // → 地址比对跳过 → 落到 Effect 2 (f) 汇聚点 → 强制 disconnect
      useAuthStore.setState({
        accessToken: null,
        refreshToken: "refresh-jwt-xyz",
        accessTokenExpireAt: null,
        refreshTokenExpireAt: 9999999999,
        sessionAddress: null,
        isAuthenticated: false,
        isLoggingIn: false,
        loginError: null,
        retryCount: 0,
        signRequested: false,
        refreshInFlight: false,
        refreshFailed: false,
      });

      const { decodeJwtAddress } = await import("@/lib/auth");
      vi.mocked(decodeJwtAddress).mockReturnValue(null);

      mockAccountState = {
        address: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        status: "connected",
        connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
        chain: { id: 56 },
      };

      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Round 5: Effect 2 (f) 强制 disconnect，UI 回落 connect 态
      expect(mockDisconnect).toHaveBeenCalled();
      // loginError 也不应有异常被写入（无地址比对，不触发 clearAuth 路径）
      expect(result.current.loginError).toBeNull();
    });
  });

  // ── 10.6 DD-131 账户切换场景（自动重登）────────────────────────────────────
  //
  // 用户预期序列：连 acct1 正常 → 在 EOA 钱包切 acct2 点连接 → 前端识别地址变化信号
  // → 自动用 acct2 重登（签名 + 后端鉴权）→ 切回 acct1 同样自动重登。
  // 本组锁定：每次账户切换都「清旧 session + 立即用新账户 performLogin」，不 disconnect，
  // 终态为新账户已登录，绝不残留「连接但无 session」的悬挂中间态。

  describe("DD-131 account switch scenario (auto re-login)", () => {
    const ADDR1 = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const ADDR2 = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

    function setSession(addr: string) {
      useAuthStore.setState({
        accessToken: "access-jwt-xyz",
        refreshToken: "refresh-jwt-xyz",
        accessTokenExpireAt: 9999999999,
        refreshTokenExpireAt: 9999999999,
        sessionAddress: addr,
        isAuthenticated: true,
        isLoggingIn: false,
        loginError: null,
        retryCount: 0,
        signRequested: false,
        refreshInFlight: false,
        refreshFailed: false,
      });
    }

    function connectedAs(addr: string) {
      mockAccountState = {
        address: addr,
        status: "connected",
        connector: { id: "com.okex.wallet", getChainId: mockConnectorGetChainId },
        chain: { id: 56 },
      };
    }

    it("acct1→acct2→回 acct1：每次切换都自动用新账户重登（签名+鉴权），全程不 disconnect", async () => {
      // 起点：acct1 已登录（预置 session，不触发 step1）
      setSession(ADDR1);
      connectedAs(ADDR1);
      const { result, rerender } = await importAndRender();
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockStep1).not.toHaveBeenCalled();

      // 切到 acct2 → 自动重登 acct2
      connectedAs(ADDR2);
      rerender();
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(mockStep1).toHaveBeenCalledWith(expect.objectContaining({ address: ADDR2 }));
      expect(result.current.isAuthenticated).toBe(true);
      expect(useAuthStore.getState().sessionAddress).toBe(ADDR2);

      // 切回 acct1 → 自动重登 acct1（session 再次切回 acct1）
      connectedAs(ADDR1);
      rerender();
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(mockStep1).toHaveBeenCalledWith(expect.objectContaining({ address: ADDR1 }));
      expect(useAuthStore.getState().sessionAddress).toBe(ADDR1);

      // 自动重登保持钱包连接，全程不 disconnect
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it("账户切换重登后终态为新账户已登录，无悬挂中间态，store 无回退掉的 reauthAddress 字段", async () => {
      setSession(ADDR1);
      connectedAs(ADDR2); // 启动即不匹配 → 自动重登 acct2
      const { result } = await importAndRender();
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(result.current.isAuthenticated).toBe(true);
      expect(useAuthStore.getState().sessionAddress).toBe(ADDR2);
      expect("reauthAddress" in useAuthStore.getState()).toBe(false);
    });
  });

  // ── 11. BUG-005 Fix A/B/D regression coverage ─────────────────────────────

  describe("BUG-005 fixes", () => {
    it("does not pass connector to signMessageAsync (Fix A — avoid double getChainId race)", async () => {
      setConnectedWithExplicitFlag();
      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockSignMessage).toHaveBeenCalled();
      const callArg = mockSignMessage.mock.calls[0]?.[0];
      // Fix A: connector 字段必须缺席（避开 wagmi 双 getChainId 竞态）
      expect(callArg).not.toHaveProperty("connector");
      // 显式 account 锁定签名地址
      expect(callArg).toHaveProperty("account");
      expect(callArg.account).toBe("0xAbC123");
    });

    it("aborts login with mainnet copy when ensureCoreChain rejects with user reject (Fix B)", async () => {
      // BD-008: ensureCoreChain 内部已封装切链逻辑，直接 mock 其 reject
      mockEnsureCoreChain.mockRejectedValueOnce(
        new Error("Please switch your wallet to BSC Mainnet and try again")
      );

      sessionStorage.setItem("oddfi_explicit_connect", "1");
      mockAccountState = {
        address: "0xAbC123",
        status: "connected",
        connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
        chain: { id: 1 }, // ethereum mainnet, not bsc
      };

      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Fix B: 抛 friendly error → 外层 catch → setLoginError + disconnect
      // clearAuth 在 setLoginError 之前调用，loginError 最终值为新抛的错误文案
      expect(useAuthStore.getState().loginError).toMatch(
        /Please switch your wallet to BSC Mainnet/
      );
      // 抛错后中断 → signMessage 不应被调用
      expect(mockSignMessage).not.toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("captures login failure to Sentry with wallet context (Fix D)", async () => {
      const Sentry = await import("@sentry/nextjs");
      const captureSpy = vi.mocked(Sentry.captureException);
      captureSpy.mockClear();

      // BUG-008 后续：user-rejected 不上报 Sentry，用非 user-rejected 错误测 Sentry 上报路径本身
      mockEnsureCoreChain.mockRejectedValueOnce(new Error("Network failure during chain switch"));

      sessionStorage.setItem("oddfi_explicit_connect", "1");
      mockAccountState = {
        address: "0xAbC123",
        status: "connected",
        connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
        chain: { id: 1 },
      };

      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Fix D: Sentry.captureException 被调用，含 wallet_state context
      expect(captureSpy).toHaveBeenCalledTimes(1);
      const [, options] = captureSpy.mock.calls[0];
      expect(options).toEqual(
        expect.objectContaining({
          tags: expect.objectContaining({ domain: "wallet", phase: "performLogin" }),
          contexts: {
            wallet_state: expect.objectContaining({
              targetChain: 56,
              isTestnet: false,
            }),
          },
        })
      );
    });

    it("does NOT report to Sentry when user actively cancels (user-rejected)", async () => {
      // BUG-008 后续：user-rejected (账户连接 / 切链 / 签名 取消) 不算系统故障，
      // 不应该污染 Sentry 告警维度。
      const Sentry = await import("@sentry/nextjs");
      const captureSpy = vi.mocked(Sentry.captureException);
      captureSpy.mockClear();

      mockEnsureCoreChain.mockRejectedValueOnce(new Error("User rejected the request"));

      sessionStorage.setItem("oddfi_explicit_connect", "1");
      mockAccountState = {
        address: "0xAbC123",
        status: "connected",
        connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
        chain: { id: 1 },
      };

      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(captureSpy).not.toHaveBeenCalled();
    });

    // Testnet case 必须放在最后：vi.resetModules() 会清空模块缓存，
    // 顶部 import 的 useAuthStore 与 useAuth 内部加载的实例分离，
    // 所以本 case 用 dynamic import 重新拿 store。
    it("uses BSC Testnet copy when IS_TESTNET=true (Fix B)", async () => {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "testnet");

      // resetModules 后 wallet-chain mock 需要重新 setup
      // vi.mock 是 hoisted 的，resetModules 后重新 import 会拿到新实例
      // 通过 mockEnsureCoreChain 的引用来控制（已在顶部声明为模块级变量）
      mockEnsureCoreChain.mockRejectedValueOnce(
        new Error("Please switch your wallet to BSC Testnet and try again")
      );

      sessionStorage.setItem("oddfi_explicit_connect", "1");
      mockAccountState = {
        address: "0xAbC123",
        status: "connected",
        connector: { id: "metaMask", getChainId: mockConnectorGetChainId },
        chain: { id: 1 },
      };

      // resetModules 后 store 实例与顶部 import 不同，必须 dynamic import
      const { useAuthStore: freshStore } = await import("@/stores/authStore");
      // 同步 isHydrated（默认 false 会被 useAuth Effect 2 拦截）
      freshStore.setState({ isHydrated: true });

      const { useAuth } = await import("./useAuth");
      renderHook(() => useAuth());

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(freshStore.getState().loginError).toMatch(/BSC Testnet/);

      vi.unstubAllEnvs();
    });
  });

  // ── 12. BD-008: ensureCoreChain 接入 + sign 自动 retry ────────────────────

  describe("BD-008: ensureCoreChain integration + sign retry", () => {
    it("calls ensureCoreChain with connector and switchChainAsync before signing", async () => {
      setConnectedWithExplicitFlag();
      await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // ensureCoreChain 必须被调用 1 次，含 connector + switchChainAsync 函数
      expect(mockEnsureCoreChain).toHaveBeenCalledTimes(1);
      expect(mockEnsureCoreChain).toHaveBeenCalledWith(
        expect.objectContaining({ id: "metaMask" }),
        expect.any(Function),
        expect.anything()
      );
      // ensureCoreChain resolve 之后 signMessage 才被调用
      expect(mockSignMessage).toHaveBeenCalledTimes(1);
    });

    it("auto retries once on transient ConnectorChainMismatchError during sign", async () => {
      // vi.resetModules()（BSC Testnet 测试）会使后续 importAndRender() 加载新模块实例，
      // 导致顶部 import 的 useAuthStore 与新 useAuth 内部的实例不同。
      // 用 dynamic import 拿到与当前模块缓存一致的 store 实例。
      const { useAuthStore: freshStore } = await import("@/stores/authStore");
      freshStore.setState({
        isAuthenticated: false,
        isLoggingIn: false,
        loginError: null,
        refreshToken: null,
        isHydrated: true,
      });

      const mismatch = new Error(
        "The current chain of the connector (id: 56) does not match the connection's chain (id: 97)."
      );
      mismatch.name = "ConnectorChainMismatchError";
      // 第一次 sign reject（mismatch）→ 触发 retry；第二次 sign resolve → 登录成功
      mockSignMessage.mockRejectedValueOnce(mismatch).mockResolvedValueOnce("0xsig");

      setConnectedWithExplicitFlag(); // 设置 explicit flag + mockAccountState（含 connector）
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // setTokens 被调用 → 登录成功
      expect(result.current.isAuthenticated).toBe(true);
      // sign 被调用 2 次（1 原始 + 1 retry）
      expect(mockSignMessage).toHaveBeenCalledTimes(2);
    });

    it("does not retry on user-rejected sign error", async () => {
      // 同上：dynamic import 确保与当前模块缓存的 store 实例一致
      const { useAuthStore: freshStore } = await import("@/stores/authStore");
      freshStore.setState({
        isAuthenticated: false,
        isLoggingIn: false,
        loginError: null,
        refreshToken: null,
        isHydrated: true,
      });

      mockSignMessage.mockRejectedValue(new Error("User rejected the request"));

      setConnectedWithExplicitFlag(); // 设置 explicit flag + mockAccountState（含 connector）
      const { result } = await importAndRender();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // sign 只被调用 1 次（无 retry）
      expect(mockSignMessage).toHaveBeenCalledTimes(1);
      // 登录失败，disconnect 被调用
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
