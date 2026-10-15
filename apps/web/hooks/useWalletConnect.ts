"use client";

/**
 * useWalletConnect — 钱包连接状态管理 Hook
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 4 条清理路径（作用域各不相同，不可合并为统一函数）                         │
 * ├─────┬──────────────────┬────────────────────────────────────────────────┤
 * │  #  │ 触发时机          │ 清理范围 & 原因                                │
 * ├─────┼──────────────────┼────────────────────────────────────────────────┤
 * │ P1  │ cleanupConnection│ wagmi reset + WC 协议层 (abortPairing)         │
 * │     │ WC 超时/WC 错误   │ + UI 状态 + loginError + clearConnectedWallet │
 * │     │                  │ → 唯一需要清理 WC provider 内部状态的路径        │
 * ├─────┼──────────────────┼────────────────────────────────────────────────┤
 * │ P2  │ resetOnError      │ UI 状态 + clearConnectedWallet                │
 * │     │ PC/DApp 连接被拒  │ → PC injected 无 WC 协议，wagmi 已处理 mutation│
 * ├─────┼──────────────────┼────────────────────────────────────────────────┤
 * │ P3  │ resetOnSettled    │ 仅 setConnectingId(null)                      │
 * │     │ 所有 onSettled    │ → 成功时不能 reset view，modal 即将被           │
 * │     │ (成功+失败)       │   isAuthenticated effect 自动关闭              │
 * ├─────┼──────────────────┼────────────────────────────────────────────────┤
 * │ P4  │ close effect      │ 立即: resetLoginUI (防快速重开残留旧 error)     │
 * │     │ modal 关闭        │ 延迟 300ms: UI 状态 + wagmi reset (等关闭动画)  │
 * └─────┴──────────────────┴────────────────────────────────────────────────┘
 *
 * handleWalletClick 入口的条件性 disconnect:
 *   - H5 外部浏览器: disconnect() → WC 需要全新 pairing session
 *   - PC 不同 connector: disconnect() → 旧连接必须断开
 *   - PC 同一 connector: incrementRetry() → 避免 disconnect+connect 同帧竞争
 *   - DApp 浏览器: 无 disconnect → 首次连接，无旧连接
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useConnect, useConfig, useDisconnect, useAccount } from "wagmi";
import { getAccount } from "wagmi/actions";
import { useAuthStore } from "@/stores/authStore";
import {
  findConnector,
  findWcModalConnector,
  findWcQrConnector,
  storeConnectedWallet,
  clearConnectedWallet,
} from "@/components/wallet/walletConfig";
import { detectWalletEnv } from "@/lib/wallet-env";
import { forceWagmiReset } from "@/lib/wallet-reset";
import { getWcDeepLink } from "@/lib/mobile-wallet-detect";
import {
  EXPLICIT_CONNECT_KEY,
  SELECTED_WALLET_KEY,
  clearWalletSessionStorage,
  revokeWalletPermissions,
} from "@/lib/wallet-session";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

const CONNECT_TIMEOUT_MS = 30_000;
const WC_CONNECT_TIMEOUT_MS = 45_000; // H5 WC deep link needs longer: user switches app + confirms + switches back

/** PC 端各快捷钱包的官网下载页 URL（无插件时跳转下载，而非 fallback WC Modal） */
const WALLET_DOWNLOAD_URLS: Record<string, string> = {
  metamask: "https://metamask.io/download/",
  okx: "https://www.okx.com/download",
  coinbase: "https://www.coinbase.com/wallet/downloads",
  binance: "https://www.bnbchain.org/en/binance-wallet",
};

interface UseWalletConnectOptions {
  open: boolean;
  onClose: () => void;
}

interface UseWalletConnectReturn {
  view: "select" | "signing";
  connectingId: string | null;
  isPending: boolean;
  /** WC deep link for manual redirect (H5 external browser only). Null until display_uri fires. */
  wcDeepLink: string | null;
  /** True when current login flow requires wallet connection approval before signing (two-step). */
  needsWalletApproval: boolean;
  handleWalletClick: (walletId: string) => void;
  /** 返回钱包选择视图（签名取消后 Reconnect 按钮调用） */
  backToSelect: () => void;
}

/** sessionStorage 写入辅助 — 静默处理 SSR / private browsing */
function ssSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* SSR / private browsing */
  }
}

/**
 * 钱包连接状态管理 Hook。
 *
 * 封装两个连接 UI（WalletConnectModal + MobileWalletConnectSheet）的共享逻辑：
 * - view 状态切换（select ↔ signing）
 * - connectingId 追踪
 * - 30s 连接超时（PC / DApp Browser）
 * - 关闭后 300ms 延迟重置状态
 * - 认证成功自动关闭
 */
export function useWalletConnect({
  open,
  onClose,
}: UseWalletConnectOptions): UseWalletConnectReturn {
  const [view, setView] = useState<"select" | "signing">("select");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [wcDeepLink, setWcDeepLink] = useState<string | null>(null);
  const [needsWalletApproval, setNeedsWalletApproval] = useState(false);
  const config = useConfig();
  const { connect, isPending, reset } = useConnect();
  const { disconnect, disconnectAsync } = useDisconnect();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setLoginError = useAuthStore((s) => s.setLoginError);
  const resetLoginUI = useAuthStore((s) => s.resetLoginUI);
  const { isConnected: walletConnected } = useAccount();

  // 认证成功自动关闭。
  // BUG-011: 必须同时校验 wagmi isConnected。否则 logout/refresh race 后
  // (isAuthenticated=true + 钱包已断开) 用户重新点「连接钱包」会被 effect 立即关掉。
  useEffect(() => {
    if (isAuthenticated && walletConnected && open) onClose();
  }, [isAuthenticated, walletConnected, open, onClose]);

  // 关闭后延迟重置 — 等待关闭动画完成再清状态
  // 同时 reset wagmi mutation 以确保 isPending 不会卡在 true
  useEffect(() => {
    if (!open) {
      // 立即清除 auth 流程状态 — 防止快速重开时残留旧错误/loading
      resetLoginUI();

      // 延迟重置视觉状态 — 等待关闭动画完成
      const timer = setTimeout(() => {
        setView("select");
        setConnectingId(null);
        setWcDeepLink(null);
        setNeedsWalletApproval(false);
        reset();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, reset, resetLoginUI]);

  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 连接 session 计数器 — 每次新连接 +1，cleanup/listener 检查是否仍为当前 session
  // 防止旧 cleanup IIFE 或 display_uri listener 干扰新连接
  const connectionSessionRef = useRef(0);

  useEffect(() => {
    return () => {
      if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    };
  }, []);

  // ── 完整清理：wagmi 状态 + WC 协议层 + UI 状态 ────────────────────────
  const cleanupConnection = useCallback(() => {
    // 递增 session，使旧的 async cleanup / listener 自动失效
    connectionSessionRef.current += 1;
    reset();
    // Best-effort WC pairing cleanup (async, non-blocking)
    const sessionAtCleanup = connectionSessionRef.current;
    (async () => {
      try {
        // 如果 cleanup 期间又开始了新连接，放弃本次 cleanup
        if (connectionSessionRef.current !== sessionAtCleanup) return;
        const connector = findWcQrConnector(config.connectors);
        if (connector) {
          const provider = await (
            connector as unknown as {
              getProvider: () => Promise<{
                abortPairingAttempt?: () => void;
                cleanupPendingPairings?: (opts?: { deletePairings?: boolean }) => Promise<void>;
              }>;
            }
          ).getProvider();
          if (connectionSessionRef.current !== sessionAtCleanup) return;
          provider?.abortPairingAttempt?.();
          await provider?.cleanupPendingPairings?.({ deletePairings: true });
        }
      } catch {
        /* best effort */
      }
    })();
    setConnectingId(null);
    setView("select");
    setWcDeepLink(null);
    setNeedsWalletApproval(false);
    setLoginError(null);
    clearConnectedWallet(); // 连接失败/超时时清除，防止残留旧值
  }, [config.connectors, reset, setLoginError]);

  // ── 连接结果回调（3 个路径共享） ──────────────────────────────────────
  const resetOnError = useCallback(() => {
    setConnectingId(null);
    setView("select");
    clearConnectedWallet(); // 连接被拒绝时清除，防止残留旧值
  }, []);

  // ── 签名取消后用户点 Reconnect：完全重置到"未连接"初始态 ───────────────
  // useAuth catch 已调 disconnect()，但 injected connector 的 disconnect 异步
  // 且部分场景只清 wagmi store 不清 provider，导致下次 handleWalletClick 里
  // getAccount(config).status 仍为 "connected" → 命中同 connector 短路 →
  // 不弹选账户直接走一步签名 → UI 闪一下拉不起插件。
  // 解决：EIP-2255 撤销钱包扩展权限 + 再 disconnect 一次 + 清 session 存储 + 清 UI 状态。
  const backToSelect = useCallback(() => {
    connectionSessionRef.current += 1;
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    reset();
    // 先撤销扩展权限（best-effort），再断开 wagmi 状态
    void revokeWalletPermissions(config).finally(() => disconnect());
    clearWalletSessionStorage();
    setConnectingId(null);
    setView("select");
    setWcDeepLink(null);
    setNeedsWalletApproval(false);
    setLoginError(null);
  }, [config, reset, disconnect, setLoginError]);
  const resetOnSettled = useCallback(() => {
    setConnectingId(null);
  }, []);

  // ── 开始连接的公共前置：标记 flag + 切换 UI ─────────────────────────────
  const beginConnect = useCallback((walletId: string) => {
    ssSet(EXPLICIT_CONNECT_KEY, "1");
    storeConnectedWallet(walletId); // 持久化用户选择，防止 wagmi connector 竞争导致图标错误
    setConnectingId(walletId);
    setView("signing");
  }, []);

  // ── H5 WC 深链连接（所有钱包统一走通用 WC connector）─────────────────────
  // 获取 WC provider → 监听 display_uri → 将 deep link 存入 state →
  // UI 渲染手动跳转按钮（用户点击 = 同步手势 = 不被 Safari/Chrome 弹窗拦截器 block）
  //
  // 所有钱包使用 findWcQrConnector（标准 WC v2 pairing），不使用 RainbowKit
  // 的 wallet-specific WC-backed connector（后者在 H5 场景下不稳定）。
  const connectViaWcProtocol = useCallback(
    async (walletId: string) => {
      const connector = findWcQrConnector(config.connectors);

      if (!connector) {
        console.warn(`[useWalletConnect] No WC QR connector found`);
        return;
      }

      // 通用 WC connector → connector.id="walletConnect"，mapWalletType 返回
      // "walletconnect"。记录真实钱包选择供 useAuth.performLogin 读取。
      ssSet(SELECTED_WALLET_KEY, walletId);

      beginConnect(walletId);

      // H5 WC 连接超时守卫 — WC 协议层默认 300s 太长，45s 对移动端更合理
      if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
      connectTimerRef.current = setTimeout(() => {
        console.warn("[useWalletConnect] WC connection timed out for", walletId);
        cleanupConnection();
      }, WC_CONNECT_TIMEOUT_MS);

      // 记录本次连接 session，用于 display_uri listener 中检查有效性
      const sessionAtConnect = connectionSessionRef.current;

      // 必须在 connect() 之前注册监听器，避免 display_uri 竞态
      const provider = await (
        connector as unknown as {
          getProvider: () => Promise<{
            once: (event: string, cb: (uri: string) => void) => void;
          }>;
        }
      ).getProvider();

      provider.once("display_uri", (uri: string) => {
        // 如果 listener 触发时已不是当前 session（超时 cleanup 或用户切换了钱包），忽略
        if (connectionSessionRef.current !== sessionAtConnect) return;

        const deepLink = getWcDeepLink(walletId, uri);
        if (!deepLink) return;

        try {
          localStorage.setItem(
            "WALLETCONNECT_DEEPLINK_CHOICE",
            JSON.stringify({ href: deepLink, name: walletId })
          );
        } catch {
          /* private browsing */
        }

        setWcDeepLink(deepLink);
      });

      connect(
        { connector },
        {
          onError: (err) => {
            Sentry.withScope((scope) => {
              scope.setLevel("error");
              scope.setTag("domain", "wallet");
              scope.setTag("wallet.phase", "wc-connect");
              scope.setContext("wallet_connect", { walletId, path: "h5-wc" });
              Sentry.captureException(err);
            });
            if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
            cleanupConnection();
          },
          onSettled: () => {
            if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
            resetOnSettled();
          },
        }
      );
    },
    [config.connectors, connect, beginConnect, cleanupConnection, resetOnSettled]
  );

  // ── handleWalletClick 主入口 ────────────────────────────────────────────
  const handleWalletClick = useCallback(
    (walletId: string) => {
      logger.info("[wallet] handleWalletClick", { walletId });
      // 清除上次连接残留的 mutation 状态和错误
      reset();
      setLoginError(null);

      const env = detectWalletEnv(config.connectors);
      logger.info("[wallet] env detected", { envType: env.type });

      // ─── H5 外部浏览器（Safari/Chrome）─────────────────────────────────
      if (env.type === "external-browser") {
        // H5 WC 需要全新 pairing session，先断开旧连接
        disconnect();

        // 通用 WalletConnect 入口 → 打开 Reown Modal（兜底）
        if (walletId === "walletconnect") {
          const connector = findWcModalConnector(config.connectors);
          if (!connector) {
            console.warn("[useWalletConnect] No WC modal connector found");
            return;
          }
          setNeedsWalletApproval(true);
          beginConnect(walletId);
          connect({ connector }, { onError: resetOnError, onSettled: resetOnSettled });
          return;
        }

        // metamask / okx / binance / coinbase → 统一走通用 WC connector + deep link
        setNeedsWalletApproval(true);
        connectViaWcProtocol(walletId).catch((err) => {
          console.error("[useWalletConnect] Failed to initialize WC provider", err);
          resetOnError();
        });
        return;
      }

      // ─── PC / DApp Browser ────────────────────────────────────────────
      const connector = findConnector(walletId, config.connectors);
      if (!connector) {
        console.warn(`[useWalletConnect] No connector found for "${walletId}"`);
        return;
      }

      // PC 端未安装扩展时，findConnector 返回 WC-backed connector（showQrModal: false）。
      // 跳转到对应钱包的官网下载页，引导用户安装插件。
      if (connector.type === "walletConnect" && walletId !== "walletconnect") {
        const downloadUrl = WALLET_DOWNLOAD_URLS[walletId];
        if (downloadUrl) {
          console.log(
            `[useWalletConnect] Wallet "${walletId}" not installed — redirecting to download page`
          );
          window.open(downloadUrl, "_blank", "noopener,noreferrer");
          return;
        }
        // 未知钱包 fallback：打开 WC Modal
        const wcModal = findWcModalConnector(config.connectors);
        if (wcModal) {
          setNeedsWalletApproval(true);
          beginConnect(walletId);
          connect({ connector: wcModal }, { onError: resetOnError, onSettled: resetOnSettled });
          return;
        }
      }

      // 从 wagmi config 直接读同步状态，绕过 React 订阅可能滞后的问题。
      // useAccount 通过 useSyncExternalStore 订阅，connector 静默 emit
      // 'connect' 事件（MetaMask 插件重新授权）时，wagmi config.state 会
      // 先于 React render 更新。若在此期间用户点击钱包，handler 闭包里
      // 的 accountStatus 仍是 "disconnected"，但 config.state.current 已
      // 指向 connector.uid；随后 connect() L110 的 `uid === current` 检查
      // 会抛 ConnectorAlreadyConnectedError，MetaMask 签名弹窗不出现。
      const fresh = getAccount(config);
      logger.info("[wallet] fresh state", {
        status: fresh.status,
        freshConnectorId: fresh.connector?.id ?? null,
        targetConnectorId: connector.id,
        hasRefreshToken: !!useAuthStore.getState().refreshToken,
      });

      // BUG-006 / BUG-009: wagmi reconnectOnMount 在刷新后让 status 进入 "reconnecting" 或
      // "connecting" 中间态（MetaMask SDK connector 走的是 connecting，不是 reconnecting）。
      // 当 oddfi_auth 已被清空（session 失效）但 wagmi.store.connections 仍持久化时，
      // status 会卡在 connecting/reconnecting + connector.uid === config.state.current。此时直接
      // 调 connect() 会撞 ConnectorAlreadyConnectedError → onError → UI 闪一下不弹钱包。
      // 修法：把 connecting / reconnecting 都视为 connected 的等效状态，走 await disconnect。
      const isLiveSameConnector =
        (fresh.status === "connected" ||
          fresh.status === "reconnecting" ||
          fresh.status === "connecting") &&
        fresh.connector?.id === connector.id;

      // 同一个 injected connector 仍处于活动状态 + 存在有效 JWT session →
      // 跳过 disconnect/connect，直接 incrementRetry 重触发 useAuth.performLogin。
      // 避免 disconnect() + connect() 同帧执行导致 wagmi 状态竞争（表现为 modal 闪一次）。
      //
      // session 失效（clearAuth 后 refreshToken=null）必须走完整 disconnect+connect，
      // 否则 MetaMask 权限未撤销会静默 emit 'connect'，UI 闪一下拉不起插件。
      // getState() 放在 && 尾部短路求值，仅当前两项成立才读 store（测试 mock 兼容）。
      if (isLiveSameConnector && !!useAuthStore.getState().refreshToken) {
        logger.info("[wallet] path=short-circuit (same connector + session)");
        setNeedsWalletApproval(false); // 一步：仅签名
        beginConnect(walletId);
        useAuthStore.getState().incrementRetry();
        return;
      }

      // 需要 disconnect 的两个条件:
      //   1) 不同 connector 占用 wagmi state（切换钱包）
      //   2) 同 connector 但 session 失效（refreshToken=null，guard 不命中下落）
      // 关键：必须 await disconnectAsync — wagmi/core/disconnect.js 中 setState 在
      // await connector.disconnect() 之后，同步 disconnect() + 同步 connect() 会撞
      // ConnectorAlreadyConnectedError（state.current 还指向旧 connector.uid）。
      // BUG-009: connecting 也算 in-flight 占用 state.current，同样需要 await disconnect。
      const needsAwaitDisconnect =
        fresh.status === "connected" ||
        fresh.status === "reconnecting" ||
        fresh.status === "connecting";
      logger.info("[wallet] path=disconnect+connect", {
        needsAwaitDisconnect,
        isLiveSameConnector,
      });

      setNeedsWalletApproval(true); // 两步：连接 + 签名
      beginConnect(walletId);

      // 连接超时守卫 — 钱包 app 无响应时重置 UI，避免无限 pending
      if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
      connectTimerRef.current = setTimeout(() => {
        setConnectingId(null);
        setView("select"); // Fallback: allow user to pick a different wallet
      }, CONNECT_TIMEOUT_MS);

      void (async () => {
        if (needsAwaitDisconnect) {
          logger.info("[wallet] awaiting disconnectAsync");
          try {
            await disconnectAsync();
            logger.info("[wallet] disconnectAsync OK");
          } catch (err) {
            // BUG-008 后续：wagmi v2 partial connector 让 disconnect 抛
            // "connector.disconnect is not a function"，wagmi store 仍卡在 'connected'。
            // 强制清 wagmi store + reset connect mutation，给本次 connect 一个干净起点。
            console.warn(
              "[useWalletConnect] disconnectAsync failed before reconnect — forcing wagmi state reset",
              err
            );
            forceWagmiReset(config);
            reset();
          }
          // BUG-010: MetaMask 扩展的 "single in-flight permission request" 规则。
          // 当 reconnectOnMount 已让扩展打开一个待审批 popup，wagmi disconnect 只能
          // 终结 SDK 端 session，扩展 popup 还在队列里。紧接 connect() 发出新的
          // eth_requestAccounts 会被扩展直接拒为 RPC 4001 (UserRejectedRequestError)。
          // 等 100ms 让扩展 popup 关闭 + queue 清空，下一次 connect 才能拉起干净的权限框。
          await new Promise((r) => setTimeout(r, 100));
        }
        logger.info("[wallet] connect()", { connectorId: connector.id });
        connect(
          { connector },
          {
            onError: (err) => {
              logger.info("[wallet] connect onError", {
                name: (err as Error)?.name,
                message: (err as Error)?.message,
              });
              Sentry.withScope((scope) => {
                scope.setLevel("error");
                scope.setTag("domain", "wallet");
                scope.setTag("wallet.phase", "injected-connect");
                scope.setContext("wallet_connect", {
                  walletId,
                  connectorId: connector.id,
                  connectorType: connector.type,
                  path: "pc-dapp",
                });
                Sentry.captureException(err);
              });
              if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
              resetOnError();
            },
            onSettled: () => {
              if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
              resetOnSettled();
            },
          }
        );
      })();
    },
    [
      config,
      connect,
      disconnect,
      disconnectAsync,
      reset,
      setLoginError,
      beginConnect,
      connectViaWcProtocol,
      resetOnError,
      resetOnSettled,
    ]
  );

  return {
    view,
    connectingId,
    isPending,
    wcDeepLink,
    needsWalletApproval,
    handleWalletClick,
    backToSelect,
  };
}

/* ------------------------------------------------------------------ */
/*  useDappBrowserConnect                                              */
/*  dApp 内置浏览器快速连接 — 跳过钱包选择 Sheet，直连 injected provider  */
/* ------------------------------------------------------------------ */

interface UseDappBrowserConnectReturn {
  /** 尝试直连 injected provider。成功返回 true，失败返回 false（调用方应降级打开 Sheet） */
  connectDapp: (walletId: string) => boolean;
}

export function useDappBrowserConnect(): UseDappBrowserConnectReturn {
  const config = useConfig();
  const { connect } = useConnect();

  const connectDapp = useCallback(
    (walletId: string): boolean => {
      const connector = findConnector(walletId, config.connectors);
      if (!connector) {
        console.warn(`[useDappBrowserConnect] No connector found for "${walletId}"`);
        return false;
      }

      ssSet(EXPLICIT_CONNECT_KEY, "1");
      storeConnectedWallet(walletId); // 持久化用户选择，防止 wagmi connector 竞争导致图标错误
      connect({ connector });
      return true;
    },
    [config.connectors, connect]
  );

  return { connectDapp };
}
