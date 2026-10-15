// authProvider：Lark login/check/logout/onError/getIdentity/getPermissions。
// role 与身份以 GET /auth/me 为准，不信任本地解码的 JWT claims（01-auth-rbac.md §1/§2）。
import type { AuthProvider } from "@refinedev/core";
import { api, unwrap } from "@/lib/api";
import { isJwtExpired } from "@/lib/jwt";
import { ApiError } from "@/types/api";
import type { Identity } from "@/types/admin-user";

const JWT_KEY = "oddfi_admin_jwt";

export const authProvider: AuthProvider = {
  // 点登录 → 整页跳后端 OAuth 入口（Vite proxy/Nginx 转 :8081）。
  login: async () => {
    window.location.href = "/auth/lark/login";
    return { success: true };
  },

  // Refine 每次路由切换调用。无 token 或本地 exp 过期 → 跳 /login。
  check: async () => {
    const token = localStorage.getItem(JWT_KEY);
    if (!token || isJwtExpired(token)) {
      localStorage.removeItem(JWT_KEY);
      return { authenticated: false, redirectTo: "/login" };
    }
    return { authenticated: true };
  },

  logout: async () => {
    try {
      await api.post("auth/logout"); // 写 jti 黑名单；失败不阻塞本地清理
    } catch (e) {
      console.warn("[authProvider] logout revoke failed, clearing local token anyway", e);
    }
    localStorage.removeItem(JWT_KEY);
    return { success: true, redirectTo: "/login" };
  },

  // dataProvider 抛 401/TOKEN_* 时触发（02-data-layer.md §4.1）。
  onError: async (error) => {
    const code = error instanceof ApiError ? error.errorCode : undefined;
    if (["UNAUTHORIZED", "TOKEN_EXPIRED", "TOKEN_INVALID"].includes(code ?? "")) {
      localStorage.removeItem(JWT_KEY);
      return { logout: true, redirectTo: "/login" };
    }
    return {};
  },

  // 权威身份：调 /auth/me（不解本地 JWT）。
  getIdentity: async (): Promise<Identity | null> => {
    const token = localStorage.getItem(JWT_KEY);
    if (!token) return null;
    try {
      return await unwrap<Identity>(api.get("auth/me"));
    } catch (e) {
      console.error("[authProvider] getIdentity failed — /auth/me unreachable or rejected", e);
      return null;
    }
  },

  // role 供 accessControlProvider / RoleGuard 消费。
  getPermissions: async () => {
    const id = (await authProvider.getIdentity?.()) as Identity | null;
    return id?.role ?? null;
  },
};
