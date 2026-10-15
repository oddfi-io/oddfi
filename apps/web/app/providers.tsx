"use client";

import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, type DisclaimerComponent } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi.config";
import { useEffect } from "react";
import { getQueryClient } from "./get-query-client";
import { hydrateCurrencyStore } from "@/stores/currencyStore";
import { hydrateThemeStore } from "@/stores/themeStore";
import { hydrateAuthStore, rehydrateAuthStore, useAuthStore } from "@/stores/authStore";
import { doRefreshSingleton } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import * as Sentry from "@sentry/nextjs";
import { OddsWsMockPanel } from "@/components/dev/OddsWsMockPanel";

import "@rainbow-me/rainbowkit/styles.css";

/**
 * Mounts auth side-effects (auto-login/logout) and token refresh timer.
 * Must be inside RainbowKitProvider so wagmi hooks are available.
 */
function AuthGate() {
  useAuth();

  const isHydrated = useAuthStore((s) => s.isHydrated);

  // 页面加载时：若 access_token 已过期但 refresh_token 仍有效，立即 refresh 一次。
  // ENH-018: 依赖 isHydrated 而非 mount-once，保证 refreshToken 从 localStorage 恢复后再评估。
  useEffect(() => {
    if (!isHydrated) return;
    const { refreshToken, isAuthenticated } = useAuthStore.getState();
    if (refreshToken && !isAuthenticated) {
      doRefreshSingleton().catch((err) => {
        const isHttpError = err && typeof err === "object" && "response" in err;
        const status = isHttpError ? (err as { response: Response }).response.status : 0;

        if (status === 401 || status === 403) {
          Sentry.captureMessage("[AuthGate] Startup refresh token revoked by server", {
            level: "warning",
          });
          useAuthStore.getState().clearAuth();
        } else {
          // 预期失败会重试，不生成 Sentry issue；真错误（refresh revoked 401/403）走上方 captureMessage
          Sentry.addBreadcrumb({
            category: "auth",
            level: "warning",
            message: "[AuthGate] Startup refresh failed — will retry on next interval",
          });
          useAuthStore.getState().clearAccessToken();
        }
      });
    }
  }, [isHydrated]);

  // 定时检查 access_token 是否即将过期，提前 2 分钟 refresh。
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 30_000;
    const REFRESH_BEFORE_EXPIRY_S = 120;

    const timer = setInterval(async () => {
      const { accessTokenExpireAt, refreshToken } = useAuthStore.getState();
      if (!refreshToken) return;
      // null = 从未登录；0 = access 已过期，待重试（不跳过）
      if (accessTokenExpireAt === null) return;

      const now = Math.floor(Date.now() / 1000);
      if (accessTokenExpireAt - now <= REFRESH_BEFORE_EXPIRY_S) {
        try {
          await doRefreshSingleton();
        } catch (err) {
          const isHttpError = err && typeof err === "object" && "response" in err;
          const status = isHttpError ? (err as { response: Response }).response.status : 0;

          if (status === 401 || status === 403) {
            // refresh_token 已被后端废弃 → 彻底登出
            Sentry.captureMessage("[AuthGate] Refresh token revoked by server", {
              level: "warning",
            });
            useAuthStore.getState().clearAuth();
          } else {
            // 网络错误 / 超时 → 清 access_token，保留 refresh_token 下次重试
            // 预期失败会重试，不生成 Sentry issue
            Sentry.addBreadcrumb({
              category: "auth",
              level: "warning",
              message: "[AuthGate] Token refresh failed — will retry",
            });
            useAuthStore.getState().clearAccessToken();
          }
        }
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return null;
}

const Disclaimer: DisclaimerComponent = ({ Text, Link }) => (
  <Text>
    By continuing, you agree to our <Link href="/terms">Terms of Service</Link> and{" "}
    <Link href="/privacy">Privacy Policy</Link>
  </Text>
);

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  // ENH-018: hydrate 从 render phase 挪到 useEffect。
  // render phase 同步 hydrate 会在 React hydration commit 前翻转 isAuthenticated，
  // 导致 SSR HTML 与 CSR 首帧不一致（TopNav MenuButton vs UserAvatarDropdown 错位）。
  // 挪到 useEffect 后首帧保持 SSR 视图（isAuthenticated=false），
  // AuthGate / useAuth Effect 2 通过 isHydrated 门槛等待 hydrate 完成再决策。
  useEffect(() => {
    hydrateAuthStore();
  }, []);

  // 跨 Tab 同步 auth 状态（DD-072 Batch 1.4）
  //
  // 背景：后端 refresh_token 在 Redis 采用覆盖写入（一次性 token）。
  // 如果 Tab A 执行 refresh 升级了 token，Tab B 内存里仍持旧 refresh_token，
  // 下次 B 用旧 token refresh 会立即 401 → 被动登出。
  //
  // 监听 localStorage 的 `oddfi_auth` key 变化（原生 storage 事件只在其他
  // tab 写入时触发，本 tab 写入不会触发），收到变化后重新 hydrate。
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== "oddfi_auth" && e.key !== null) return;
      rehydrateAuthStore();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    hydrateCurrencyStore();
    hydrateThemeStore();

    if (process.env.NEXT_PUBLIC_ENABLE_MSW === "true") {
      import("@/mocks/browser").then(({ worker }) => {
        worker.start({
          onUnhandledRequest: "bypass",
        });
      });
    } else if ("serviceWorker" in navigator) {
      // Unregister leftover MSW service worker from dev/preview sessions
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          if (reg.active?.scriptURL.includes("mockServiceWorker")) {
            reg.unregister();
          }
        }
      });
    }

    if (
      process.env.NODE_ENV === "development" &&
      !process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
    ) {
      console.warn("[WalletConnect] Missing project ID — QR code scanning will not work");
    }
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
          theme={darkTheme({
            accentColor: "#5972FE",
            accentColorForeground: "white",
            borderRadius: "large",
            overlayBlur: "small",
          })}
          appInfo={{
            appName: "Oddfi",
            disclaimer: Disclaimer,
          }}
        >
          <AuthGate />
          {children}
          {process.env.NODE_ENV !== "production" && <OddsWsMockPanel />}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
