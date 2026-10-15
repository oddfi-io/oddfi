"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { WALLETS, resolveWalletId, getConnectedWallet } from "@/components/wallet/walletConfig";

/**
 * 解析当前已连接钱包的图标 URL。
 *
 * 解析优先级：
 *   1. localStorage 持久化的用户选择（规避 wagmi connector 竞争）
 *   2. connector 对象多级解析（id/name/rdns）
 *   3. connector.icon data URI（EIP-6963 提供）
 *
 * 返回 undefined 时调用方应渲染兜底占位（例如首字母或通用图标）。
 */
export function useConnectedWalletIcon(): string | undefined {
  const { connector } = useAccount();

  return useMemo(() => {
    const stored = getConnectedWallet();
    if (stored) {
      const byStored = WALLETS.find((w) => w.id === stored);
      if (byStored) return byStored.icon;
    }
    const walletId = resolveWalletId(connector);
    if (walletId) {
      const byResolved = WALLETS.find((w) => w.id === walletId);
      if (byResolved) return byResolved.icon;
    }
    if (connector?.icon) {
      console.warn(
        "[useConnectedWalletIcon] Fell through to connector.icon — wallet not in known map",
        { id: connector.id, name: connector.name }
      );
      return connector.icon;
    }
    return undefined;
  }, [connector]);
}
