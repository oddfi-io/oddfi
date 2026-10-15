/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const STORAGE_KEY = "oddfi_auth";

// Each test needs a fresh module to reset the _hydrated closure variable.
// We use vi.resetModules() + dynamic import to achieve this.
async function loadModule() {
  vi.resetModules();
  const mod = await import("./authStore");
  return mod;
}

describe("authStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ---------- setTokens ----------
  describe("setTokens", () => {
    it("sets all token fields and isAuthenticated=true", async () => {
      const { useAuthStore } = await loadModule();
      const access = { token: "acc-123", expire_at: 9999999999 };
      const refresh = { token: "ref-456", expire_at: 9999999999 };

      useAuthStore.getState().setTokens(access, refresh);
      const state = useAuthStore.getState();

      expect(state.accessToken).toBe("acc-123");
      expect(state.refreshToken).toBe("ref-456");
      expect(state.accessTokenExpireAt).toBe(9999999999);
      expect(state.refreshTokenExpireAt).toBe(9999999999);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoggingIn).toBe(false);
      expect(state.loginError).toBeNull();
      expect(state.signRequested).toBe(false);
    });

    it("clears existing loginError", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setLoginError("some error");
      expect(useAuthStore.getState().loginError).toBe("some error");

      useAuthStore.getState().setTokens({ token: "a", expire_at: 1 }, { token: "r", expire_at: 2 });
      expect(useAuthStore.getState().loginError).toBeNull();
    });

    it("persists tokens to localStorage", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore
        .getState()
        .setTokens({ token: "acc-x", expire_at: 100 }, { token: "ref-y", expire_at: 200 });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.accessToken).toBe("acc-x");
      expect(stored.refreshToken).toBe("ref-y");
      expect(stored.accessTokenExpireAt).toBe(100);
      expect(stored.refreshTokenExpireAt).toBe(200);
    });
  });

  // ---------- setAccessToken ----------
  describe("setAccessToken", () => {
    it("updates only access token fields, preserves refresh fields", async () => {
      const { useAuthStore } = await loadModule();
      // First set full tokens
      useAuthStore
        .getState()
        .setTokens({ token: "old-acc", expire_at: 100 }, { token: "ref-keep", expire_at: 500 });

      // Update only access token
      useAuthStore.getState().setAccessToken({ token: "new-acc", expire_at: 200 });
      const state = useAuthStore.getState();

      expect(state.accessToken).toBe("new-acc");
      expect(state.accessTokenExpireAt).toBe(200);
      expect(state.refreshToken).toBe("ref-keep");
      expect(state.refreshTokenExpireAt).toBe(500);
      expect(state.isAuthenticated).toBe(true);
    });

    it("persists updated access token to localStorage while preserving refresh", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore
        .getState()
        .setTokens({ token: "acc-1", expire_at: 10 }, { token: "ref-1", expire_at: 20 });

      useAuthStore.getState().setAccessToken({ token: "acc-2", expire_at: 30 });
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.accessToken).toBe("acc-2");
      expect(stored.accessTokenExpireAt).toBe(30);
      expect(stored.refreshToken).toBe("ref-1");
      expect(stored.refreshTokenExpireAt).toBe(20);
    });
  });

  // ---------- setRefreshToken ----------
  describe("setRefreshToken", () => {
    it("updates only refresh token string, other fields unchanged", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore
        .getState()
        .setTokens({ token: "acc-keep", expire_at: 100 }, { token: "old-ref", expire_at: 500 });

      useAuthStore.getState().setRefreshToken("new-ref");
      const state = useAuthStore.getState();

      expect(state.refreshToken).toBe("new-ref");
      expect(state.accessToken).toBe("acc-keep");
      expect(state.accessTokenExpireAt).toBe(100);
      expect(state.refreshTokenExpireAt).toBe(500);
    });

    it("persists updated refresh token to localStorage", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore
        .getState()
        .setTokens({ token: "acc", expire_at: 10 }, { token: "ref-old", expire_at: 20 });

      useAuthStore.getState().setRefreshToken("ref-new");
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.refreshToken).toBe("ref-new");
      expect(stored.accessToken).toBe("acc");
    });
  });

  // ---------- clearAuth ----------
  describe("clearAuth", () => {
    it("clears all auth state fields", async () => {
      const { useAuthStore } = await loadModule();
      // Set up some state
      useAuthStore.getState().setTokens({ token: "a", expire_at: 1 }, { token: "r", expire_at: 2 });
      useAuthStore.getState().incrementRetry();
      useAuthStore.setState({ signRequested: true });

      useAuthStore.getState().clearAuth();
      const state = useAuthStore.getState();

      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.accessTokenExpireAt).toBeNull();
      expect(state.refreshTokenExpireAt).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoggingIn).toBe(false);
      expect(state.loginError).toBeNull();
      expect(state.retryCount).toBe(0);
      expect(state.signRequested).toBe(false);
    });

    it("removes data from localStorage", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setTokens({ token: "a", expire_at: 1 }, { token: "r", expire_at: 2 });
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      useAuthStore.getState().clearAuth();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("closes AI chat floating window (state hygiene · 防止登出后浮窗残留)", async () => {
      const { useAuthStore } = await loadModule();
      const { useAiChatSessionStore } = await import("./aiChatSessionStore");
      // 模拟用户已登录 + 已打开 chat（mode=dock）
      useAuthStore.getState().setTokens({ token: "a", expire_at: 1 }, { token: "r", expire_at: 2 });
      useAiChatSessionStore.getState().setMode("dock");
      expect(useAiChatSessionStore.getState().mode).toBe("dock");

      useAuthStore.getState().clearAuth();

      // clearAuth 必须把 chat mode 拉回 closed
      expect(useAiChatSessionStore.getState().mode).toBe("closed");
      expect(useAiChatSessionStore.getState().isOpen).toBe(false);
      // lastMode 保留（用户偏好），下次登录恢复 dock
      expect(useAiChatSessionStore.getState().lastMode).toBe("dock");
    });

    it("DD-140: 清空乐观链上注单（防止切账号后上个用户 pending 卡可见 · C-01）", async () => {
      const { useAuthStore } = await loadModule();
      const { usePendingOnchainBetsStore } = await import("./pendingOnchainBetsStore");
      // 模拟用户已登录 + 有乐观注单
      useAuthStore.getState().setTokens({ token: "a", expire_at: 1 }, { token: "r", expire_at: 2 });
      usePendingOnchainBetsStore.getState().add({
        orderId: 1,
        txHash: "0xabc",
        selection: { id: "s1" } as import("@/types/betting").BetSelection,
        bet: { id: "p1" } as import("@/types/portfolio").PortfolioBet,
        status: "pending",
        createdAt: 1,
      });
      expect(Object.keys(usePendingOnchainBetsStore.getState().byOrderId)).toHaveLength(1);

      useAuthStore.getState().clearAuth();

      expect(Object.keys(usePendingOnchainBetsStore.getState().byOrderId)).toHaveLength(0);
    });
  });

  // ---------- setLoggingIn / setLoginError ----------
  describe("setLoggingIn", () => {
    it("sets isLoggingIn to true", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setLoggingIn(true);
      expect(useAuthStore.getState().isLoggingIn).toBe(true);
    });

    it("sets isLoggingIn to false", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setLoggingIn(true);
      useAuthStore.getState().setLoggingIn(false);
      expect(useAuthStore.getState().isLoggingIn).toBe(false);
    });
  });

  describe("setLoginError", () => {
    it("sets loginError and resets isLoggingIn to false", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setLoggingIn(true);

      useAuthStore.getState().setLoginError("Network timeout");
      const state = useAuthStore.getState();

      expect(state.loginError).toBe("Network timeout");
      expect(state.isLoggingIn).toBe(false);
    });

    it("can clear loginError by passing null", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setLoginError("err");
      useAuthStore.getState().setLoginError(null);
      expect(useAuthStore.getState().loginError).toBeNull();
    });
  });

  // ---------- setSignRequested ----------
  describe("setSignRequested", () => {
    it("sets signRequested flag", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setSignRequested(true);
      expect(useAuthStore.getState().signRequested).toBe(true);

      useAuthStore.getState().setSignRequested(false);
      expect(useAuthStore.getState().signRequested).toBe(false);
    });
  });

  // ---------- incrementRetry ----------
  describe("incrementRetry", () => {
    it("increments retryCount by 1", async () => {
      const { useAuthStore } = await loadModule();
      expect(useAuthStore.getState().retryCount).toBe(0);

      useAuthStore.getState().incrementRetry();
      expect(useAuthStore.getState().retryCount).toBe(1);

      useAuthStore.getState().incrementRetry();
      expect(useAuthStore.getState().retryCount).toBe(2);
    });

    it("clears loginError on retry", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setLoginError("some error");
      useAuthStore.getState().incrementRetry();

      expect(useAuthStore.getState().loginError).toBeNull();
      expect(useAuthStore.getState().retryCount).toBe(1);
    });
  });

  // ---------- hydrateAuthStore ----------
  describe("hydrateAuthStore", () => {
    it("restores full auth state when access token is not expired", async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accessToken: "valid-acc",
          refreshToken: "valid-ref",
          accessTokenExpireAt: futureTime,
          refreshTokenExpireAt: futureTime + 7200,
        })
      );

      const { useAuthStore, hydrateAuthStore } = await loadModule();
      hydrateAuthStore();

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe("valid-acc");
      expect(state.refreshToken).toBe("valid-ref");
      expect(state.accessTokenExpireAt).toBe(futureTime);
      expect(state.refreshTokenExpireAt).toBe(futureTime + 7200);
      expect(state.isAuthenticated).toBe(true);
    });

    it("restores only refresh token when access expired but refresh is valid", async () => {
      const now = Math.floor(Date.now() / 1000);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accessToken: "expired-acc",
          refreshToken: "still-valid-ref",
          accessTokenExpireAt: now - 100, // expired
          refreshTokenExpireAt: now + 3600, // still valid
        })
      );

      const { useAuthStore, hydrateAuthStore } = await loadModule();
      hydrateAuthStore();

      const state = useAuthStore.getState();
      expect(state.accessToken).toBeNull(); // not restored
      expect(state.refreshToken).toBe("still-valid-ref");
      expect(state.refreshTokenExpireAt).toBe(now + 3600);
      expect(state.isAuthenticated).toBe(false);
    });

    it("clears localStorage when both tokens are expired", async () => {
      const now = Math.floor(Date.now() / 1000);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accessToken: "exp-acc",
          refreshToken: "exp-ref",
          accessTokenExpireAt: now - 200,
          refreshTokenExpireAt: now - 100,
        })
      );

      const { useAuthStore, hydrateAuthStore } = await loadModule();
      hydrateAuthStore();

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      // State should remain at defaults
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().accessToken).toBeNull();
    });

    it("does nothing when localStorage has no auth data", async () => {
      const { useAuthStore, hydrateAuthStore } = await loadModule();
      hydrateAuthStore();

      const state = useAuthStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it("does not crash on corrupted localStorage data", async () => {
      localStorage.setItem(STORAGE_KEY, "not-valid-json{{{");

      const { useAuthStore, hydrateAuthStore } = await loadModule();
      hydrateAuthStore();

      // Should silently handle the error and not change state
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("does not crash on partial/missing fields in localStorage", async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: "only-acc" }));

      const { useAuthStore, hydrateAuthStore } = await loadModule();
      hydrateAuthStore();

      // loadFromStorage returns null when refreshToken is missing
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("only hydrates once (idempotent guard)", async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accessToken: "acc-once",
          refreshToken: "ref-once",
          accessTokenExpireAt: futureTime,
          refreshTokenExpireAt: futureTime + 7200,
        })
      );

      const { useAuthStore, hydrateAuthStore } = await loadModule();
      hydrateAuthStore();
      expect(useAuthStore.getState().accessToken).toBe("acc-once");

      // Clear store state manually
      useAuthStore.setState({ accessToken: null, isAuthenticated: false });

      // Second call should be a no-op due to _hydrated flag
      hydrateAuthStore();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  // ---------- initial state ----------
  describe("initial state", () => {
    it("starts with all defaults", async () => {
      const { useAuthStore } = await loadModule();
      const state = useAuthStore.getState();

      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.accessTokenExpireAt).toBeNull();
      expect(state.refreshTokenExpireAt).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoggingIn).toBe(false);
      expect(state.loginError).toBeNull();
      expect(state.retryCount).toBe(0);
      expect(state.signRequested).toBe(false);
      expect(state.refreshInFlight).toBe(false);
      expect(state.refreshFailed).toBe(false);
      expect(state.sessionAddress).toBeNull();
    });
  });

  // ---------- DD-072: refreshInFlight / refreshFailed ----------
  describe("refresh lifecycle flags (DD-072)", () => {
    it("setRefreshInFlight toggles boolean state", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setRefreshInFlight(true);
      expect(useAuthStore.getState().refreshInFlight).toBe(true);
      useAuthStore.getState().setRefreshInFlight(false);
      expect(useAuthStore.getState().refreshInFlight).toBe(false);
    });

    it("setRefreshFailed toggles boolean state", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setRefreshFailed(true);
      expect(useAuthStore.getState().refreshFailed).toBe(true);
      useAuthStore.getState().setRefreshFailed(false);
      expect(useAuthStore.getState().refreshFailed).toBe(false);
    });

    it("setTokens resets refreshFailed to false (successful login clears stale failure)", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setRefreshFailed(true);
      useAuthStore.getState().setTokens({ token: "a", expire_at: 1 }, { token: "r", expire_at: 2 });
      expect(useAuthStore.getState().refreshFailed).toBe(false);
    });

    it("clearAuth clears refreshInFlight and refreshFailed", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setRefreshInFlight(true);
      useAuthStore.getState().setRefreshFailed(true);
      useAuthStore.getState().clearAuth();
      const state = useAuthStore.getState();
      expect(state.refreshInFlight).toBe(false);
      expect(state.refreshFailed).toBe(false);
    });
  });

  // ---------- DD-072: sessionAddress ----------
  describe("sessionAddress (DD-072 Batch 4)", () => {
    it("setSessionAddress updates state", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore.getState().setSessionAddress("0xABC");
      expect(useAuthStore.getState().sessionAddress).toBe("0xABC");
      useAuthStore.getState().setSessionAddress(null);
      expect(useAuthStore.getState().sessionAddress).toBeNull();
    });

    it("setTokens writes sessionAddress when passed", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore
        .getState()
        .setTokens({ token: "a", expire_at: 1 }, { token: "r", expire_at: 2 }, "0xDEADBEEF");
      expect(useAuthStore.getState().sessionAddress).toBe("0xDEADBEEF");
    });

    it("sessionAddress persists in localStorage when set alongside tokens", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore
        .getState()
        .setTokens({ token: "a", expire_at: 1 }, { token: "r", expire_at: 2 }, "0xAA");
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.sessionAddress).toBe("0xAA");
    });

    it("clearAuth resets sessionAddress to null", async () => {
      const { useAuthStore } = await loadModule();
      useAuthStore
        .getState()
        .setTokens({ token: "a", expire_at: 1 }, { token: "r", expire_at: 2 }, "0xAA");
      useAuthStore.getState().clearAuth();
      expect(useAuthStore.getState().sessionAddress).toBeNull();
    });
  });

  // ---------- DD-072 Round 5: deriveAuthUIState（2 态） ----------
  describe("deriveAuthUIState (DD-072 Round 5 2 态状态机)", () => {
    const base = {
      walletConnected: false,
      hasRefreshToken: false,
      refreshFailed: false,
    };

    it("wallet=no session=no → connect", async () => {
      const { deriveAuthUIState } = await loadModule();
      expect(deriveAuthUIState(base)).toBe("connect");
    });

    it("wallet=yes session=no → connect（Round 5 折叠：signin 瞬时态由 Effect 2 强制 disconnect）", async () => {
      const { deriveAuthUIState } = await loadModule();
      expect(deriveAuthUIState({ ...base, walletConnected: true })).toBe("connect");
    });

    it("wallet=no session=yes (hasRefreshToken) → ready（wagmi 静默重连过渡态）", async () => {
      const { deriveAuthUIState } = await loadModule();
      expect(deriveAuthUIState({ ...base, hasRefreshToken: true })).toBe("ready");
    });

    it("wallet=yes session=yes → ready", async () => {
      const { deriveAuthUIState } = await loadModule();
      expect(deriveAuthUIState({ ...base, walletConnected: true, hasRefreshToken: true })).toBe(
        "ready"
      );
    });

    it("refreshFailed=true（wallet=yes + hasRefreshToken=true）→ connect（Round 5：失败路径不再留 signin）", async () => {
      const { deriveAuthUIState } = await loadModule();
      expect(
        deriveAuthUIState({
          ...base,
          walletConnected: true,
          hasRefreshToken: true,
          refreshFailed: true,
        })
      ).toBe("connect");
    });

    it("refreshFailed=true（wallet=no + hasRefreshToken=true）→ connect（不再闪 ready）", async () => {
      const { deriveAuthUIState } = await loadModule();
      expect(deriveAuthUIState({ ...base, hasRefreshToken: true, refreshFailed: true })).toBe(
        "connect"
      );
    });

    it("hydrate 空窗期：wallet=no + hasRefreshToken=true → ready（Fix A 根治场景）", async () => {
      const { deriveAuthUIState } = await loadModule();
      expect(deriveAuthUIState({ ...base, hasRefreshToken: true })).toBe("ready");
    });
  });

  // ---------- DD-072: rehydrate (跨 Tab 同步) ----------
  describe("rehydrateAuthStore (跨 Tab storage 事件)", () => {
    it("applies fresh localStorage state, bypasses _hydrated guard", async () => {
      const { useAuthStore, hydrateAuthStore, rehydrateAuthStore } = await loadModule();

      // 第一次 hydrate（localStorage 为空）
      hydrateAuthStore();
      expect(useAuthStore.getState().refreshToken).toBeNull();

      // 模拟其他 tab 写入
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accessToken: "fresh-acc",
          refreshToken: "fresh-ref",
          accessTokenExpireAt: futureTime,
          refreshTokenExpireAt: futureTime + 3600,
        })
      );

      // rehydrate 应该绕过 _hydrated 单次保护
      rehydrateAuthStore();
      expect(useAuthStore.getState().refreshToken).toBe("fresh-ref");
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it("clears in-memory state when other tab clears storage", async () => {
      const { useAuthStore, rehydrateAuthStore } = await loadModule();
      const futureTime = Math.floor(Date.now() / 1000) + 3600;

      useAuthStore
        .getState()
        .setTokens(
          { token: "acc", expire_at: futureTime },
          { token: "ref", expire_at: futureTime + 3600 }
        );
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // 模拟其他 tab 执行 clearAuth（直接清 localStorage）
      localStorage.removeItem(STORAGE_KEY);
      rehydrateAuthStore();

      expect(useAuthStore.getState().refreshToken).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});
