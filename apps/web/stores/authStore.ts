import { create } from "zustand";
import { logger } from "@/lib/logger";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import { usePendingOnchainBetsStore } from "@/stores/pendingOnchainBetsStore";
import { useCashingOutBetsStore } from "@/stores/cashingOutBetsStore";
import type { WalletErrorKind } from "@/lib/wallet-error";

const STORAGE_KEY = "oddfi_auth";

interface TokenData {
  token: string;
  expire_at: number;
}

interface PersistedAuth {
  accessToken: string;
  refreshToken: string;
  accessTokenExpireAt: number;
  refreshTokenExpireAt: number;
  sessionAddress?: string;
}

function loadFromStorage(): PersistedAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAuth;
    if (!parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(state: PersistedAuth) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded — non-critical */
  }
}

function removeFromStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* SSR safe */
  }
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpireAt: number | null;
  refreshTokenExpireAt: number | null;
  /** 登录成功时写入的钱包地址，用于地址切换保护（fallback：decodeJwtAddress） */
  sessionAddress: string | null;

  isAuthenticated: boolean;
  isLoggingIn: boolean;
  loginError: string | null;
  /**
   * BUG-013 v2 · 结构化错误分类，UI 优先消费它走 i18n 矩阵
   * `wallet.error.{kind}.title/description`。loginError 字符串保留作向后兼容兜底
   * （现有 isUserCanceledMessage 等基于字符串的判断仍可用）。
   */
  loginErrorKind: WalletErrorKind | null;

  /** 正在执行 refresh 请求；用于判定 UI "session yes" 的短窗口 */
  refreshInFlight: boolean;
  /** 非 401/403 的 refresh 失败（网络/超时）；UI 展示降级提示 */
  refreshFailed: boolean;

  /** Incremented by UI retry buttons; watched by useAuth to re-trigger login. */
  retryCount: number;

  /**
   * BUG-011: 防止 logout 与 in-flight refresh 竞态。
   * 每次 clearAuth 时 ++；doRefreshSingleton 在进入时捕获当前值，写 token 前再次对比，
   * 不一致 = 用户中途已显式 logout → 丢弃 refresh 结果，避免幽灵复活
   * （表现：isAuthenticated=true 但 wagmi disconnected，UI 状态错位）。
   */
  sessionEpoch: number;

  /**
   * ENH-018: localStorage 是否已完成首次 hydrate。
   * SSR/CSR 首帧为 false；hydrate 完成后翻 true，useAuth Effect 2 / AuthGate startup
   * 依赖它作为门槛，避免在 hydrate 未跑前读到空 refreshToken 触发 force-disconnect。
   */
  isHydrated: boolean;

  /**
   * True while waiting for wallet signature (Step 1 API succeeded, signMessageAsync pending).
   * Used by MobileWalletConnectSheet to show "Open wallet to sign" deep link on mobile WC path.
   */
  signRequested: boolean;

  setTokens: (access: TokenData, refresh: TokenData, sessionAddress?: string) => void;
  /** Refresh flow only updates access token; refresh token expiry is preserved. */
  setAccessToken: (access: TokenData) => void;
  /** Update refresh token (token rotation after successful refresh). */
  setRefreshToken: (token: string, expireAt?: number) => void;
  /** Clear access token on refresh failure; keeps refreshToken + isAuthenticated intact. */
  clearAccessToken: () => void;
  clearAuth: () => void;
  setLoggingIn: (v: boolean) => void;
  setLoginError: (e: string | null) => void;
  setLoginErrorKind: (kind: WalletErrorKind | null) => void;
  setSignRequested: (v: boolean) => void;
  setRefreshInFlight: (v: boolean) => void;
  setRefreshFailed: (v: boolean) => void;
  setSessionAddress: (addr: string | null) => void;
  /** Clear login UI state in one call — loginError + isLoggingIn + signRequested */
  resetLoginUI: () => void;
  incrementRetry: () => void;
}

// SSR-safe: always initialize with defaults to avoid hydration mismatch.
// Client-side localStorage state is restored via hydrateAuthStore() after mount.
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  accessTokenExpireAt: null,
  refreshTokenExpireAt: null,
  sessionAddress: null,
  isAuthenticated: false,
  isLoggingIn: false,
  loginError: null,
  loginErrorKind: null,
  refreshInFlight: false,
  refreshFailed: false,
  retryCount: 0,
  signRequested: false,
  isHydrated: false,
  sessionEpoch: 0,

  setTokens: (access, refresh, sessionAddress) => {
    set((s) => {
      const nextAddr = sessionAddress ?? s.sessionAddress ?? null;
      saveToStorage({
        accessToken: access.token,
        refreshToken: refresh.token,
        accessTokenExpireAt: access.expire_at,
        refreshTokenExpireAt: refresh.expire_at,
        sessionAddress: nextAddr ?? undefined,
      });
      return {
        accessToken: access.token,
        refreshToken: refresh.token,
        accessTokenExpireAt: access.expire_at,
        refreshTokenExpireAt: refresh.expire_at,
        sessionAddress: nextAddr,
        isAuthenticated: true,
        isLoggingIn: false,
        loginError: null,
        loginErrorKind: null,
        signRequested: false,
        refreshFailed: false,
      };
    });
  },

  clearAuth: () => {
    set((s) => ({
      accessToken: null,
      refreshToken: null,
      accessTokenExpireAt: null,
      refreshTokenExpireAt: null,
      sessionAddress: null,
      isAuthenticated: false,
      isLoggingIn: false,
      loginError: null,
      loginErrorKind: null,
      retryCount: 0,
      signRequested: false,
      refreshInFlight: false,
      refreshFailed: false,
      // BUG-011: 让 in-flight refresh 写回时检测到 epoch 已变化 → 丢弃结果
      sessionEpoch: s.sessionEpoch + 1,
    }));
    removeFromStorage();
    // AI Chat 浮窗状态卫生：登出后强制关闭，避免下次登录看到上次的 dock/float 残留
    useAiChatSessionStore.getState().close();
    // DD-140：清除乐观链上注单，避免切账号/登出后上个用户的 pending 卡跨用户可见（REV-v1-A C-01）
    usePendingOnchainBetsStore.getState().clear();
    // ENH-038：清除乐观「正在取消」标记，避免切账号/登出后上个用户的 cashing_out 态跨用户残留
    useCashingOutBetsStore.getState().clear();
  },

  setAccessToken: (access) => {
    set((s) => {
      saveToStorage({
        accessToken: access.token,
        refreshToken: s.refreshToken ?? "",
        accessTokenExpireAt: access.expire_at,
        refreshTokenExpireAt: s.refreshTokenExpireAt ?? 0,
        sessionAddress: s.sessionAddress ?? undefined,
      });
      return {
        accessToken: access.token,
        accessTokenExpireAt: access.expire_at,
        isAuthenticated: true,
      };
    });
  },

  clearAccessToken: () => {
    set((s) => {
      // Storage uses ""/ 0 as "cleared" sentinels; Zustand uses null.
      // loadFromStorage only gates on refreshToken, so "" accessToken won't discard valid refresh.
      saveToStorage({
        accessToken: "",
        refreshToken: s.refreshToken ?? "",
        accessTokenExpireAt: 0,
        refreshTokenExpireAt: s.refreshTokenExpireAt ?? 0,
        sessionAddress: s.sessionAddress ?? undefined,
      });
      return { accessToken: null, accessTokenExpireAt: null };
    });
  },

  setRefreshToken: (token, expireAt) => {
    set((s) => {
      const newExpireAt = expireAt ?? s.refreshTokenExpireAt ?? 0;
      saveToStorage({
        accessToken: s.accessToken ?? "",
        refreshToken: token,
        accessTokenExpireAt: s.accessTokenExpireAt ?? 0,
        refreshTokenExpireAt: newExpireAt,
        sessionAddress: s.sessionAddress ?? undefined,
      });
      return { refreshToken: token, refreshTokenExpireAt: newExpireAt };
    });
  },

  setLoggingIn: (v) => set({ isLoggingIn: v }),
  setLoginError: (e) => set({ loginError: e, isLoggingIn: false }),
  setLoginErrorKind: (kind) => set({ loginErrorKind: kind }),
  setSignRequested: (v) => set({ signRequested: v }),
  setRefreshInFlight: (v) => set({ refreshInFlight: v }),
  setRefreshFailed: (v) => set({ refreshFailed: v }),
  setSessionAddress: (addr) => {
    set((s) => {
      if (s.refreshToken) {
        saveToStorage({
          accessToken: s.accessToken ?? "",
          refreshToken: s.refreshToken,
          accessTokenExpireAt: s.accessTokenExpireAt ?? 0,
          refreshTokenExpireAt: s.refreshTokenExpireAt ?? 0,
          sessionAddress: addr ?? undefined,
        });
      }
      return { sessionAddress: addr };
    });
  },
  resetLoginUI: () =>
    set({ loginError: null, loginErrorKind: null, isLoggingIn: false, signRequested: false }),
  incrementRetry: () =>
    set((s) => ({ retryCount: s.retryCount + 1, loginError: null, loginErrorKind: null })),
}));

// ============================================================
// 2 态状态机派生（Round 5：折叠 signin 中间态）
// ============================================================

export type AuthUIState = "connect" | "ready";

/**
 * 基于钱包连接状态 + session 状态派生 2 态 UI。
 *
 *               wallet=no        wallet=yes
 *             ┌────────────────┬────────────────┐
 *  session=no │ [1] connect    │ [1] connect *  │
 *             ├────────────────┼────────────────┤
 * session=yes │ [2] ready      │ [2] ready      │
 *             └────────────────┴────────────────┘
 *
 * [*] wallet=yes + session=no 是瞬时态，应被 hooks/useAuth.ts Effect 2 (f)
 *     分支强制 disconnect，回落到 [1] connect。任何落在此格子的 UI 渲染都是
 *     派生窗口内的瞬间，不应暴露"Sign In"按钮。
 *
 * [2] ready —— wallet=no session=yes 时为 wagmi 静默重连过渡态；
 *             完全信任 reconnectOnMount=true。
 *
 * sessionYes = hasRefreshToken && !refreshFailed
 */
export function deriveAuthUIState(args: {
  hasRefreshToken: boolean;
  refreshFailed: boolean;
  walletConnected?: boolean;
}): AuthUIState {
  const { hasRefreshToken, refreshFailed } = args;
  const sessionYes = hasRefreshToken && !refreshFailed;
  return sessionYes ? "ready" : "connect";
}

/**
 * React selector — UI 组件直接消费。
 *
 * Round 5 折叠后不再依赖 walletConnected：wallet=yes + session=no 瞬时态
 * 由 useAuth Effect 2 (f) 强制 disconnect，不会停留到 UI 层。
 */
export function useAuthUIState(): AuthUIState {
  const hasRefreshToken = useAuthStore((s) => !!s.refreshToken);
  const refreshFailed = useAuthStore((s) => s.refreshFailed);
  return deriveAuthUIState({ hasRefreshToken, refreshFailed });
}

/**
 * Restore auth tokens from localStorage. Call once in a top-level useEffect.
 * - Access token still valid → restore full isAuthenticated state
 * - Access expired, refresh still valid → restore refresh token only (AuthGate will auto-refresh)
 * - Both expired → clear storage
 *
 * 跨 Tab 同步通过 rehydrateAuthStore 重新执行。
 */
let _hydrated = false;
export function hydrateAuthStore() {
  if (_hydrated) return;
  _hydrated = true;
  applyHydration();
}

/** 跨 Tab storage 事件专用：绕过单次保护，重新从 localStorage 同步内存 state */
export function rehydrateAuthStore() {
  applyHydration();
}

function applyHydration() {
  const persisted = loadFromStorage();
  if (!persisted) {
    // 其他 tab 执行了 clearAuth → 同步清理本 tab 内存 state
    if (useAuthStore.getState().refreshToken) {
      logger.debug("[auth] hydrate — no storage found, clearing in-memory session");
      useAuthStore.setState({
        accessToken: null,
        refreshToken: null,
        accessTokenExpireAt: null,
        refreshTokenExpireAt: null,
        sessionAddress: null,
        isAuthenticated: false,
        isHydrated: true,
      });
    } else {
      logger.debug("[auth] hydrate — no storage, starting disconnected");
      useAuthStore.setState({ isHydrated: true });
    }
    return;
  }

  const now = Math.floor(Date.now() / 1000);

  if (persisted.accessTokenExpireAt > now) {
    logger.debug(
      `[auth] hydrate — access token valid, restoring full session (addr=${persisted.sessionAddress?.slice(0, 10) ?? "unknown"})`
    );
    useAuthStore.setState({
      accessToken: persisted.accessToken,
      refreshToken: persisted.refreshToken,
      accessTokenExpireAt: persisted.accessTokenExpireAt,
      refreshTokenExpireAt: persisted.refreshTokenExpireAt,
      sessionAddress: persisted.sessionAddress ?? null,
      isAuthenticated: true,
      isHydrated: true,
    });
    return;
  }

  if (persisted.refreshTokenExpireAt > now) {
    // Access token expired — only restore refresh token
    // AuthGate timer will auto-refresh on next tick
    logger.debug(
      "[auth] hydrate — access expired, refresh token valid, will auto-refresh on next tick"
    );
    useAuthStore.setState({
      refreshToken: persisted.refreshToken,
      refreshTokenExpireAt: persisted.refreshTokenExpireAt,
      sessionAddress: persisted.sessionAddress ?? null,
      isHydrated: true,
    });
    return;
  }

  // Both tokens expired
  logger.debug("[auth] hydrate — both tokens expired, clearing storage");
  removeFromStorage();
  useAuthStore.setState({ isHydrated: true });
}
