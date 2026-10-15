"use client";

import { useProxyWalletStore } from "@/stores/proxyWalletStore";
import type { ProxyWalletInfo, ProxyWalletBalance } from "@/lib/proxy-wallet/types";

/**
 * Returns the proxy wallet assigned to the current user.
 *
 * The wallet address is fetched by useAuth (via getDepositAddress) after JWT
 * login and stored in proxyWalletStore. This hook reads from the store only.
 *
 * 代理钱包是后端绑定的"账户属性"，生命周期与 session 绑定，而非 EOA 连接态。
 * 因此不在这里监听 wagmi disconnect 清空 store —— 清理由 performLogout 统一执行。
 * 这避免了钱包临时断开（切链、刷新、reconnect 抖动）导致 proxy 被误清。
 */
export function useProxyWallet(): {
  wallet: ProxyWalletInfo | null;
  balances: ProxyWalletBalance[];
  isLoading: boolean;
  isAssigned: boolean;
  error: string | null;
} {
  const proxyWallet = useProxyWalletStore((s) => s.proxyWallet);
  const isAssigning = useProxyWalletStore((s) => s.isAssigning);
  const assignError = useProxyWalletStore((s) => s.assignError);

  return {
    wallet: proxyWallet,
    balances: [],
    isLoading: isAssigning,
    isAssigned: !!proxyWallet,
    error: assignError,
  };
}
