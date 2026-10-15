/**
 * @vitest-environment jsdom
 *
 * DD-072 Round 5 集成测试 — 2 态状态机端到端场景
 *
 * 覆盖 Checklist 中的关键验收点：
 * 1. hydrate → refresh pending → wagmi 尚未 reconnect → UI 保持 ready
 * 2. hydrate → refresh 网络失败 → clearAuth 自动触发，UI 回落 connect
 * 2b. hydrate → refresh 返回 401 → clearAuth 自动触发，UI 回落 connect
 * 3. 跨 Tab：A tab 改 storage → B tab 内存状态同步
 * 4. Refresh 20s 硬超时 → refreshInFlight 释放 + clearAuth 触发
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock ky 以控制 refresh 响应
vi.mock("ky", () => {
  const mockPost = vi.fn();
  const mockGet = vi.fn();
  return {
    default: {
      create: () => ({
        get: mockGet,
        post: mockPost,
      }),
      retry: () => ({ __retry: true }),
    },
    __mockPost: mockPost,
  };
});

const { __mockPost } = (await import("ky")) as unknown as {
  __mockPost: ReturnType<typeof vi.fn>;
};

const STORAGE_KEY = "oddfi_auth";

async function loadFreshModules() {
  vi.resetModules();
  const store = await import("@/stores/authStore");
  const api = await import("@/lib/api");
  return { ...store, ...api };
}

describe("DD-072 Round 5 2 态状态机 — 集成场景", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 1: 隔日返回（refresh_token 有效）—— wagmi 未 reconnect 窗口不应退出登录
  // ────────────────────────────────────────────────────────────────
  it("场景 1：access 过期 + refresh 有效 → refresh pending 短窗口 UI 保持 ready", async () => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: "expired-acc",
        refreshToken: "valid-ref",
        accessTokenExpireAt: now - 100,
        refreshTokenExpireAt: now + 30 * 86400,
        sessionAddress: "0xABC",
      })
    );

    const { useAuthStore, hydrateAuthStore, deriveAuthUIState, doRefreshSingleton } =
      await loadFreshModules();

    hydrateAuthStore();

    // hydrate 后：只还原 refreshToken，access 未还原
    expect(useAuthStore.getState().refreshToken).toBe("valid-ref");
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    // 模拟 refresh 响应延迟 100ms
    let resolveRefresh!: (v: unknown) => void;
    __mockPost.mockReturnValueOnce({
      json: () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    });

    // 启动 refresh（AuthGate useEffect 行为）
    const refreshPromise = doRefreshSingleton();

    // 此刻 refreshInFlight=true，但 isAuthenticated 仍为 false
    expect(useAuthStore.getState().refreshInFlight).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    // UI 派生：wagmi 尚未 reconnect（walletConnected=false）+ refresh 飞行中 → ready
    // 这是关键：Round 5 保持 hasRefreshToken=true + refreshFailed=false 时 UI ready 不动
    const uiBeforeWagmi = deriveAuthUIState({
      walletConnected: false,
      hasRefreshToken: !!useAuthStore.getState().refreshToken,
      refreshFailed: useAuthStore.getState().refreshFailed,
    });
    expect(uiBeforeWagmi).toBe("ready");

    // wagmi autoConnect 完成
    const uiAfterWagmi = deriveAuthUIState({
      walletConnected: true,
      hasRefreshToken: !!useAuthStore.getState().refreshToken,
      refreshFailed: useAuthStore.getState().refreshFailed,
    });
    expect(uiAfterWagmi).toBe("ready");

    // refresh 成功返回
    resolveRefresh({
      code: 0,
      message: "ok",
      data: {
        access_token: "new-acc",
        expire_at: now + 3600,
        refresh_token: "rotated-ref",
      },
    });
    await refreshPromise;

    expect(useAuthStore.getState().refreshInFlight).toBe(false);
    expect(useAuthStore.getState().refreshFailed).toBe(false);
    expect(useAuthStore.getState().accessToken).toBe("new-acc");
    expect(useAuthStore.getState().refreshToken).toBe("rotated-ref");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 2: refresh 网络失败 → Round 5 自动 clearAuth，UI 回落 connect
  // ────────────────────────────────────────────────────────────────
  it("场景 2：refresh 网络错误 → clearAuth 自动触发，UI 派生 connect", async () => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: "",
        refreshToken: "valid-ref",
        accessTokenExpireAt: 0,
        refreshTokenExpireAt: now + 30 * 86400,
      })
    );

    const { useAuthStore, hydrateAuthStore, deriveAuthUIState, doRefreshSingleton } =
      await loadFreshModules();
    hydrateAuthStore();

    // 模拟网络错误：无 response 字段
    __mockPost.mockReturnValueOnce({
      json: () => Promise.reject(new Error("Network timeout")),
    });

    await expect(doRefreshSingleton()).rejects.toThrow();

    expect(useAuthStore.getState().refreshInFlight).toBe(false);
    // Round 5: 非 401 失败路径 setRefreshFailed(true) 后立刻 clearAuth；
    // clearAuth 内部会把 refreshFailed 重置为 false。
    expect(useAuthStore.getState().refreshFailed).toBe(false);
    expect(useAuthStore.getState().refreshToken).toBeNull(); // Round 5: clearAuth 触发
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    // UI 派生：hasRefreshToken=false → connect（Effect 2 (f) 会强制 disconnect）
    const ui = deriveAuthUIState({
      walletConnected: true,
      hasRefreshToken: false,
      refreshFailed: false,
    });
    expect(ui).toBe("connect");
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 2b: refresh 返回 401 —— Round 5 自动 clearAuth
  // ────────────────────────────────────────────────────────────────
  it("场景 2b：refresh 返回 401 → clearAuth 自动触发，refreshToken 清空", async () => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: "",
        refreshToken: "revoked-ref",
        accessTokenExpireAt: 0,
        refreshTokenExpireAt: now + 30 * 86400,
      })
    );

    const { useAuthStore, hydrateAuthStore, deriveAuthUIState, doRefreshSingleton } =
      await loadFreshModules();
    hydrateAuthStore();

    const httpError = Object.assign(new Error("Unauthorized"), {
      response: { status: 401 } as Response,
    });
    __mockPost.mockReturnValueOnce({
      json: () => Promise.reject(httpError),
    });

    await expect(doRefreshSingleton()).rejects.toBe(httpError);

    expect(useAuthStore.getState().refreshInFlight).toBe(false);
    expect(useAuthStore.getState().refreshFailed).toBe(false);
    // Round 5: 401 也触发 clearAuth —— refresh_token 立刻清空
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    const ui = deriveAuthUIState({
      walletConnected: true,
      hasRefreshToken: false,
      refreshFailed: false,
    });
    expect(ui).toBe("connect");
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 3: 跨 Tab 同步 —— storage 事件触发 rehydrate
  // ────────────────────────────────────────────────────────────────
  it("场景 3：Tab A refresh 后 storage 变化 → Tab B 内存 refresh_token 同步", async () => {
    const { useAuthStore, rehydrateAuthStore } = await loadFreshModules();

    const now = Math.floor(Date.now() / 1000);
    // Tab B 原有 token（旧 refresh_token）
    useAuthStore
      .getState()
      .setTokens(
        { token: "old-acc", expire_at: now + 100 },
        { token: "old-ref", expire_at: now + 30 * 86400 }
      );
    expect(useAuthStore.getState().refreshToken).toBe("old-ref");

    // 模拟 Tab A 刚完成 token rotation，写入新 refresh_token
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: "rotated-acc",
        refreshToken: "rotated-ref",
        accessTokenExpireAt: now + 3600,
        refreshTokenExpireAt: now + 30 * 86400,
      })
    );

    // 模拟 providers.tsx 的 storage 监听器
    rehydrateAuthStore();

    expect(useAuthStore.getState().refreshToken).toBe("rotated-ref");
    expect(useAuthStore.getState().accessToken).toBe("rotated-acc");
  });

  it("场景 3b：Tab A 登出 → Tab B 清理内存状态", async () => {
    const { useAuthStore, rehydrateAuthStore } = await loadFreshModules();
    const now = Math.floor(Date.now() / 1000);

    useAuthStore
      .getState()
      .setTokens(
        { token: "acc", expire_at: now + 100 },
        { token: "ref", expire_at: now + 30 * 86400 }
      );

    // Tab A 执行 clearAuth → 清 storage
    localStorage.removeItem(STORAGE_KEY);
    rehydrateAuthStore();

    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 4: 20s 硬超时 —— TCP 半开不 hang，Round 5 自动 clearAuth
  // ────────────────────────────────────────────────────────────────
  it("场景 4：refresh 请求永不返回 → 20s 硬超时触发 clearAuth", async () => {
    vi.useFakeTimers();
    const now = Math.floor(Date.now() / 1000);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: "",
        refreshToken: "valid-ref",
        accessTokenExpireAt: 0,
        refreshTokenExpireAt: now + 30 * 86400,
      })
    );

    const { useAuthStore, hydrateAuthStore, doRefreshSingleton } = await loadFreshModules();
    hydrateAuthStore();

    // 挂起的 fetch —— 永不 resolve
    __mockPost.mockReturnValueOnce({
      json: () => new Promise(() => {}),
    });

    const refreshPromise = doRefreshSingleton();
    // 立即 attach handler 避免 unhandled rejection
    const caught = refreshPromise.catch((err: Error) => err);

    // 进入状态
    expect(useAuthStore.getState().refreshInFlight).toBe(true);

    // 推进 20s+1，触发超时
    await vi.advanceTimersByTimeAsync(20_001);

    const err = await caught;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("timeout");

    expect(useAuthStore.getState().refreshInFlight).toBe(false);
    // Round 5: 超时后 clearAuth 自动触发 → refreshFailed 重置 + refresh_token 清空
    expect(useAuthStore.getState().refreshFailed).toBe(false);
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 5: 并发安全 —— 多处同时触发 doRefreshSingleton 共享同一 Promise
  // ────────────────────────────────────────────────────────────────
  it("场景 5：并发调用 doRefreshSingleton 复用同一飞行请求", async () => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: "",
        refreshToken: "valid-ref",
        accessTokenExpireAt: 0,
        refreshTokenExpireAt: now + 30 * 86400,
      })
    );

    const { useAuthStore, hydrateAuthStore, doRefreshSingleton } = await loadFreshModules();
    hydrateAuthStore();

    let resolveRefresh!: (v: unknown) => void;
    __mockPost.mockReturnValueOnce({
      json: () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    });

    const p1 = doRefreshSingleton();
    const p2 = doRefreshSingleton();
    const p3 = doRefreshSingleton();

    // ky post 应该只被调用一次
    expect(__mockPost).toHaveBeenCalledTimes(1);

    resolveRefresh({
      code: 0,
      message: "ok",
      data: { access_token: "new-acc", expire_at: now + 3600 },
    });

    await Promise.all([p1, p2, p3]);

    expect(useAuthStore.getState().accessToken).toBe("new-acc");
    expect(useAuthStore.getState().refreshInFlight).toBe(false);
  });
});
