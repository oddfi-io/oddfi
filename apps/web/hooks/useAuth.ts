"use client";

import { useEffect, useRef } from "react";
import { useAccount, useSignMessage, useDisconnect, useSwitchChain, useConfig } from "wagmi";
import type { Connector } from "wagmi";
import { useAuthStore } from "@/stores/authStore";
import { useProxyWalletStore } from "@/stores/proxyWalletStore";
import { loginByWalletStep1, loginByWalletStep2, logoutApi, getDepositAddress } from "@/lib/api";
import { buildSignMessage, mapWalletType, mapChainName, decodeJwtAddress } from "@/lib/auth";
import {
  classifyWalletError,
  mapWalletError,
  shouldReportToSentry,
  getWalletErrorInfo,
  type LoginPhase,
} from "@/lib/wallet-error";
import { ensureCoreChain } from "@/lib/wallet-chain";
import { waitForConnectorRecovery } from "@/lib/wallet-recovery";
import { forceWagmiReset } from "@/lib/wallet-reset";
import { CORE_CHAIN } from "@/lib/chains";
import { getQueryClient } from "@/app/get-query-client";
import { accountKeys } from "@/lib/query-keys";
import { logger } from "@/lib/logger";
import {
  EXPLICIT_CONNECT_KEY,
  EXPLICIT_CONNECT_TS_KEY,
  SELECTED_WALLET_KEY,
  LAST_CONNECTOR_ID_KEY,
  clearWalletSessionStorage,
} from "@/lib/wallet-session";
import * as Sentry from "@sentry/nextjs";
import { IS_TESTNET } from "@/lib/network-mode";

/** EXPLICIT_CONNECT_KEY TTL — localStorage 条目超过此时长视为无效，防止残留 flag 误触签名。 */
const EXPLICIT_CONNECT_TTL_MS = 5 * 60 * 1000; // 5 分钟

/**
 * 模块级 logout 引用，供 useWallet 在 wagmi disconnect 完成后调用。
 * useAuth() 挂载时赋值，卸载时清空，保证单例行为。
 */
let globalLogout: (() => Promise<void>) | null = null;

/**
 * 供 useWallet 调用：在 wagmi disconnect onSuccess 里触发完整 session 登出。
 * 若 useAuth 尚未挂载（极少数情况），则静默忽略。
 */
export function triggerGlobalLogout(): Promise<void> {
  logger.info("[auth] triggerGlobalLogout invoked — wagmi disconnect cascading to session logout");
  return globalLogout?.() ?? Promise.resolve();
}

/**
 * EOA 钱包两步签名登录 Hook。
 *
 * 挂载于 AuthGate（providers.tsx），全局生效。
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  DD-072 Round 5: 2 态状态机（signin 折叠为 connect）              │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  [1] connect    │ session=no             → Connect Wallet 按钮  │
 * │  [2] ready      │ session=yes            → Deposit 按钮         │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * session 失效路径（签名取消 / refresh 401 / refresh 网络错误）收敛到 Effect 2 (f) 强制 disconnect。
 *
 * DD-131 例外：**账户切换**（钱包地址变化）→ 清旧 session 后**立即用新账户 performLogin**
 * （自动重登：签名 + 后端鉴权），不 disconnect；重登失败 / 拒签再由 catch 收敛到 disconnect。
 */

export function useAuth() {
  const { address, status, connector, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect, disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const config = useConfig();

  const isConnected = status === "connected";

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoggingIn = useAuthStore((s) => s.isLoggingIn);
  const loginError = useAuthStore((s) => s.loginError);
  const retryCount = useAuthStore((s) => s.retryCount);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const {
    setTokens,
    clearAuth,
    setLoggingIn,
    setLoginError,
    setLoginErrorKind,
    setSignRequested,
    setSessionAddress,
  } = useAuthStore.getState();
  const { setProxyWallet, clearProxy, setAssignError } = useProxyWalletStore.getState();

  /** 防止同一次连接重复触发 performLogin */
  const loginCalledRef = useRef(false);

  // ─── 绑定 globalLogout（供 useWallet.onSuccess 调用，实现 wagmi disconnect 级联 session 登出）
  // 用 useEffect + cleanup 保证单例：只有 AuthGate 挂载的那个 useAuth 实例持有引用。
  useEffect(() => {
    globalLogout = performLogout;
    return () => {
      globalLogout = null;
    };
    // performLogout 通过闭包捕获 loginCalledRef，不需要列入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Effect 1: 充值地址（isAuthenticated→true 时，含页面刷新场景）──────
  // 充值地址 = 后端 Magic 托管 EOA（登录时解析落库）。偶发 "magic deposit address
  // not ready"（后端 self-heal，下次调用即恢复）→ 失败/空地址做有限重试（1.5s/3s
  // 退避），全部失败才落 assignError；isAuthenticated 翻转/卸载时取消挂起重试。
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const RETRY_DELAYS_MS = [1500, 3000];

    const scheduleRetry = (attemptIndex: number, finalError: string) => {
      const delay = RETRY_DELAYS_MS[attemptIndex];
      if (delay == null) {
        setAssignError(finalError);
        return;
      }
      console.warn(
        `[useAuth] getDepositAddress retrying in ${delay}ms — attempt ${attemptIndex + 2}/${RETRY_DELAYS_MS.length + 1}`
      );
      timers.push(setTimeout(() => attempt(attemptIndex + 1), delay));
    };

    const attempt = (attemptIndex: number) => {
      getDepositAddress()
        .then((d) => {
          if (cancelled) return;
          if (!d?.address) {
            console.error("[useAuth] getDepositAddress returned empty address", d);
            scheduleRetry(
              attemptIndex,
              "Deposit address unavailable — please refresh and try again."
            );
            return;
          }
          setProxyWallet({
            address: d.address as `0x${string}`,
            network: "BNB Smart Chain",
            chainId: CORE_CHAIN.id,
          });
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("[useAuth] getDepositAddress failed — deposit address unavailable", err);
          scheduleRetry(
            attemptIndex,
            "Failed to load deposit address — please refresh and try again."
          );
        });
    };

    attempt(0);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ─── Effect 2: 钱包连接成功后的决策树（DD-072 Round 5 核心）──────────────
  //
  // 决策顺序（首个命中即 return）：
  //   a) 地址切换 — 钱包地址与 session 不符 → clearAuth + 立即用新账户 performLogin（DD-131 自动重登）
  //   b) 已登录 → return（ready 态）
  //   c) 正在登录 → return
  //   d) isExplicit=true → performLogin（用户主动发起登录）
  //   e) hasRefreshToken && refreshInFlight → return（等 refresh，UI 保持 ready 短窗口）
  //   f) 汇聚点：wallet 连 + 无 session + 非 isExplicit + 非 refresh → disconnect → connect 态
  //
  // Round 5: signin 中间态被折叠到 connect，任何 session=no 路径都强制 disconnect。
  useEffect(() => {
    if (status !== "connected") return;
    if (!address) return;
    // ENH-018: 等 authStore 从 localStorage hydrate 完成再决策。
    // 未 hydrate 时 refreshToken=null（初始值），force-disconnect 分支会误触发，
    // 把已有 session 的已登录用户登出。
    if (!isHydrated) return;

    // 读取并立即清除 explicit flag（原子操作）
    let isExplicit = false;
    try {
      const fromSession = sessionStorage.getItem(EXPLICIT_CONNECT_KEY) === "1";

      const localFlag = localStorage.getItem(EXPLICIT_CONNECT_KEY) === "1";
      const localTs = parseInt(localStorage.getItem(EXPLICIT_CONNECT_TS_KEY) ?? "0", 10);
      const localValid = localFlag && Date.now() - localTs < EXPLICIT_CONNECT_TTL_MS;

      isExplicit = fromSession || localValid;
      if (fromSession) sessionStorage.removeItem(EXPLICIT_CONNECT_KEY);
      if (localFlag) {
        localStorage.removeItem(EXPLICIT_CONNECT_KEY);
        localStorage.removeItem(EXPLICIT_CONNECT_TS_KEY);
      }
    } catch {
      /* SSR / private browsing */
    }

    // (a) 地址切换保护 —— 无论是否正在登录都必须先校验（避免旧地址 session 泄漏给新地址）
    // 注意：refresh 接口不校验 address（后端 handler 代码确认），必须前端兜底。
    const {
      accessToken,
      isAuthenticated: authed,
      sessionAddress,
      refreshToken,
      refreshInFlight,
    } = useAuthStore.getState();
    logger.debug(
      `[auth] wallet connected — addr=${address.slice(0, 10)}, isExplicit=${isExplicit}, authed=${authed}, hasRefresh=${!!refreshToken}, refreshInFlight=${refreshInFlight}`
    );
    const expectedAddr = sessionAddress || decodeJwtAddress(accessToken);
    if (
      expectedAddr &&
      expectedAddr.toLowerCase() !== address.toLowerCase() &&
      (authed || refreshToken)
    ) {
      // 用户切换钱包是预期行为，不生成 Sentry issue；保留为面包屑便于调试真 error 时回溯
      Sentry.addBreadcrumb({
        category: "wallet",
        level: "info",
        message:
          "[useAuth] Wallet account switched — auto re-login new account (sign + backend auth)",
        data: {
          expected: expectedAddr.slice(0, 10),
          actual: address.slice(0, 10),
          phase: "address-switch-relogin",
        },
      });
      // DD-131: 账户切换 → 清旧 session 后**立即用新账户重新登录**（performLogin 触发签名 + 后端鉴权）。
      // 不 disconnect：保持钱包连接，直接重登；失败 / 拒签由 performLogin catch 收敛到 disconnect。
      // 用户在 EOA 钱包里点「连接」即为用户手势，这里响应该信号自动发起重登（与首登同样在 await 后弹签）。
      // 重入安全：clearAuth 后 effect 重跑时 performLogin 已同步置 isLoggingIn=true → 分支(c) 拦截；
      // 且 expectedAddr 此刻为 null（已清），不会再进本分支 → 无签名 spam / 无死循环。
      logger.info(
        `[auth] branch a — account switched, auto re-login new account ${address.slice(0, 10)}`
      );
      clearAuth();
      loginCalledRef.current = true;
      performLogin(address, connector);
      return;
    }

    // (b) 已登录
    if (authed) {
      logger.debug("[auth] branch ready — session valid, no action");
      return;
    }

    // (c) 正在登录
    if (isLoggingIn) {
      logger.debug("[auth] branch skip — login already in flight");
      return;
    }

    // 防 StrictMode 双重挂载 / status 重复触发
    if (loginCalledRef.current) {
      logger.debug("[auth] branch skip — loginCalledRef guards StrictMode double-mount");
      return;
    }

    // (d) 用户主动登录
    if (isExplicit) {
      logger.info("[auth] branch signin — explicit flag set, starting performLogin");
      loginCalledRef.current = true;
      performLogin(address, connector);
      return;
    }

    // (e) refresh 正在飞行 —— UI 已在 "session yes" 短窗口，静等结果
    if (refreshToken && refreshInFlight) {
      logger.debug("[auth] branch wait — refresh token in flight, UI stays ready");
      return;
    }

    // (f) 汇聚点：钱包连接 + 无 session + 非 isExplicit + 非 refresh in-flight
    //    → 强制 disconnect 回落到 connect 态（Round 5 state 折叠）
    //    触发场景：签名取消后的 catch 流程、refresh 失败 clearAuth 级联、
    //    地址切换导致 clearAuth 后的重入、任何导致 hasRefreshToken=false 的路径
    logger.info(
      "[auth] branch force-disconnect — wallet connected but no session, auto-disconnect to connect state"
    );
    disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAuthenticated, isLoggingIn, address, connector, chain, isHydrated]);

  // ─── Effect 3: 用户手动重试（retry 按钮 / 签名失败重试）────────────────
  useEffect(() => {
    if (retryCount === 0) return;
    loginCalledRef.current = false;
    if (isConnected && address) {
      performLogin(address, connector);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  // ─── Effect 4: 钱包断开（status="disconnected"）→ 不再登出业务 session ────
  //
  // DD-072 关键变更：钱包断开不代表 session 失效。refreshToken 有效时，
  // UI 保持 ready 态，等 wagmi reconnectOnMount 静默重连完成。
  useEffect(() => {
    if (status !== "disconnected") return;
    logger.info(
      "[auth] wallet disconnected — keeping session (DD-072), waiting for wagmi silent reconnect"
    );
    loginCalledRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ─── Core auth logic ─────────────────────────────────────────────────────

  /** Timeout for signMessageAsync — prevents infinite hang on mobile WalletConnect */
  const SIGN_TIMEOUT_MS = 30_000;

  async function performLogin(addr: string, conn: Connector | undefined) {
    logger.info(
      `[auth] performLogin start — addr=${addr.slice(0, 10)}, connector=${conn?.id ?? "unknown"}`
    );
    setLoggingIn(true);
    setLoginError(null);
    setSignRequested(false);
    // BUG-008: signRetried 追踪 connector-chain-mismatch 单次自动重试（声明在 try 外供 Sentry 读取）
    let signRetried = false;
    // BUG-008 后续：追踪当前阶段，让 friendly toast 文案按用户实际操作步骤匹配，
    // 避免"取消了账户连接"却显示"签名取消"这种语境错位
    let phase: LoginPhase = "connect";
    try {
      // BD-008: 统一切链入口，store + live 双收敛到 CORE_CHAIN 才继续
      // 防御 wagmi mid-connect 给出的 partial connector（用户取消账户连接时观察到 conn.getChainId
      // is not a function 的真实 bug）—— 这种状态归类为用户主动取消而非系统错误
      if (!conn || typeof conn.getChainId !== "function") {
        throw new Error("Wallet connection was canceled. Please try again");
      }
      phase = "switch";
      await ensureCoreChain(conn, switchChainAsync, config);
      phase = "sign";

      let walletType = mapWalletType(conn);
      try {
        const selected = sessionStorage.getItem(SELECTED_WALLET_KEY);
        if (selected) {
          sessionStorage.removeItem(SELECTED_WALLET_KEY);
          walletType = selected;
        }
      } catch {
        /* SSR / private browsing */
      }
      const chainName = mapChainName(CORE_CHAIN.id);

      const step1 = await loginByWalletStep1({
        address: addr,
        wallet_type: walletType,
        chain: chainName,
      });

      const issuedAt = Math.floor(Date.now() / 1000);
      const message = buildSignMessage(addr, chainName, step1.data.nonce, issuedAt);

      setSignRequested(true);

      // BUG-008 / BUG-013: 残余 race 兜底（用户在 sign 弹窗弹出后切链 / 多扩展 provider contention），单次 retry
      const trySign = async (msgToSign: string): Promise<`0x${string}`> => {
        try {
          return await Promise.race([
            // BUG-005 Fix A: 不传 connector，避开 wagmi 双 getChainId 竞态；显式传 account 锁定签名地址（review M-1）
            signMessageAsync({ message: msgToSign, account: addr as `0x${string}` }),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Signature timeout — please open your wallet app to sign")),
                SIGN_TIMEOUT_MS
              )
            ),
          ]);
        } catch (err) {
          if (!signRetried) {
            const kind = classifyWalletError(err);
            if (kind === "connector-chain-mismatch") {
              // BUG-005 / BUG-008: 切链后 cache vs live 漂移，200ms 足够 cache 收敛
              signRetried = true;
              await new Promise((r) => setTimeout(r, 200));
              return trySign(msgToSign);
            }
            if (kind === "connector-not-connected") {
              // BUG-013: 多扩展 provider contention → wagmi state.current 被异步清空
              // critic M-1: 不用固定 sleep（state 自愈依赖钱包再 emit connect，与 React commit 无关），
              // 主动 subscribe 等 state.current 非空；超时则原 error 透传不掩盖根因
              signRetried = true;
              const recovered = await waitForConnectorRecovery(config, 1500);
              if (!recovered) throw err;
              return trySign(msgToSign);
            }
          }
          throw err;
        }
      };

      const signature = await trySign(message);

      const step2 = await loginByWalletStep2({
        session_id: step1.session_id,
        address: addr,
        wallet_type: walletType,
        chain: chainName,
        message,
        signature,
      });

      // setTokens: isAuthenticated=true → 触发 Effect 1 获取充值地址
      // DD-072 Batch 4: 同时写入 sessionAddress（地址切换保护的主路径，JWT decode 作为 fallback）
      setTokens(step2.data.access_token, step2.data.refresh_token, addr);
      setSessionAddress(addr);
      // 持久化 connector.id 给 Reconnect Wallet 按钮：wagmi disconnect 不清，仅 logout 清
      try {
        if (conn?.id) localStorage.setItem(LAST_CONNECTOR_ID_KEY, conn.id);
      } catch {
        /* private browsing */
      }
      logger.info(
        `[auth] performLogin success — tokens written, connector=${conn?.id ?? "unknown"} persisted`
      );
    } catch (err) {
      const isUserCancel = classifyWalletError(err) === "user-rejected";
      const msg = mapWalletError(err, phase);
      // BUG-013 v2: 结构化错误分类，UI 优先消费 kind 走 i18n 矩阵
      const errorInfo = getWalletErrorInfo(err, phase);
      // 用户主动取消用 console.log 标记（非真实故障），其他走 console.error 保留 stack
      if (isUserCancel) {
        console.log("[useAuth] Login canceled by user — phase=" + phase, err);
      } else {
        console.error("[useAuth] Login failed — phase=" + phase, err);
      }
      // 关键 cleanup 必须先做 + await disconnect 等 wagmi connector state 完全收敛
      // 否则 MetaMask SDK connector 的异步 disconnect 未完成时，用户下次点 connect 撞 race
      // → 钱包扩展不弹账户 prompt（典型 BUG-006 家族表现）
      // 顺序关键：clearAuth 会把 loginError 一并重置为 null，必须最后 setLoginError
      // loginError 由 user action (backToSelect/closeModal) 或下次 performLogin 集中清，
      // ConnectButton toast 不再消费它（详见 ConnectButton useRef 去重）
      clearAuth();
      setLoginError(msg);
      setLoginErrorKind(errorInfo.kind);
      try {
        await disconnectAsync();
      } catch (disconnectErr) {
        // wagmi v2 边界 bug：connector 是 partial instance（缺 disconnect 方法），
        // disconnectAsync 抛 TypeError。此时手动清 wagmi store 防止脏 state 累积导致后续
        // reconnect 流程失败（"签名窗不弹 + Wallet RPC did not reflect" 连锁错误）
        console.warn(
          "[useAuth] disconnectAsync failed (partial connector?) — forcing wagmi state reset",
          disconnectErr
        );
        forceWagmiReset(config);
      }
      // 兜底重置 loginCalledRef：原本依赖 Effect 4 (status='disconnected') 重置，但 wagmi
      // 脏 state 下 status 不变 → ref 卡 true → 下次 connect 撞 StrictMode guard 不调 performLogin
      loginCalledRef.current = false;
      // 用户主动取消不上报 Sentry —— 避免噪音淹没真实故障告警
      if (!shouldReportToSentry(err)) return;
      // Sentry 异步上报，不阻塞用户的下一次操作（避免 await conn.getChainId() 阻塞 catch 路径）
      // 历史教训：catch 内 await Sentry context 取 live_chain 会让 disconnect 推迟，
      // 与用户立即重连产生 wagmi state race（详见 worktree BUG 复盘）
      void (async () => {
        const liveChain =
          typeof conn?.getChainId === "function" ? await conn.getChainId().catch(() => null) : null;
        Sentry.captureException(err, {
          tags: {
            domain: "wallet",
            phase: "performLogin",
            login_phase: phase,
            error_kind: classifyWalletError(err),
            sign_retried: String(signRetried),
          },
          contexts: {
            wallet_state: {
              addr: addr.slice(0, 10),
              connector: conn?.id ?? "unknown",
              live_chain: liveChain,
              targetChain: CORE_CHAIN.id,
              isTestnet: IS_TESTNET,
            },
          },
        });
      })();
    } finally {
      setLoggingIn(false);
      setSignRequested(false);
    }
  }

  async function performLogout() {
    logger.info("[auth] performLogout start — clearing server session + local state");
    try {
      await logoutApi();
    } catch {
      /* best effort */
    }
    clearAuth();
    clearProxy();
    // 统一清理所有钱包 session 存储（EXPLICIT_CONNECT / SELECTED_WALLET / LAST_CONNECTOR_ID / CONNECTED_WALLET）
    clearWalletSessionStorage();
    getQueryClient().removeQueries({ queryKey: accountKeys.all });
    loginCalledRef.current = false;
    logger.info(
      "[auth] performLogout complete — oddfi_auth cleared, wallet session storage cleared, query cache dropped"
    );
  }

  return {
    isAuthenticated,
    isLoggingIn,
    loginError,
    retry: useAuthStore.getState().incrementRetry,
    logout: performLogout,
  };
}
