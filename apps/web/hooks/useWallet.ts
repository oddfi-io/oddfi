"use client";

import { useCallback } from "react";
import { useAccount, useBalance, useConfig, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { isSupportedChain } from "@/lib/chains";
import { useWalletDisplayStore } from "@/stores/walletDisplayStore";
import { triggerGlobalLogout } from "@/hooks/useAuth";
import { clearWalletSessionStorage, revokeWalletPermissions } from "@/lib/wallet-session";

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { resetActiveSymbol } = useWalletDisplayStore();
  const config = useConfig();
  const { disconnect: wagmiDisconnect, isPending: isDisconnecting } = useDisconnect({
    mutation: {
      onSuccess: () => {
        resetActiveSymbol();
        // 用户主动 disconnect → 与签名取消后的 Reconnect 同等初始化流程：
        // 1) 清所有 session 存储 flag（EXPLICIT_CONNECT / SELECTED_WALLET / LAST_CONNECTOR_ID / CONNECTED_WALLET）
        // 2) 级联触发完整 session 登出（logoutApi + clearAuth + clearProxy + query cache drop）
        clearWalletSessionStorage();
        triggerGlobalLogout();
      },
    },
  });

  // 包装 wagmi disconnect：先 EIP-2255 撤销钱包扩展权限，再调 wagmi disconnect。
  // 否则 MetaMask 等 injected 仍持有已授权权限，下次 connect() 会静默触发，
  // UI 只闪一下拉不起钱包弹窗，用户必须刷新页面。
  const disconnect = useCallback(() => {
    void revokeWalletPermissions(config).finally(() => wagmiDisconnect());
  }, [config, wagmiDisconnect]);

  const { data: nativeBalance } = useBalance({
    address,
    query: { enabled: !!address },
  });

  // 已连接 + 当前链不在 SUPPORTED_CHAINS 中 = 错误网络
  const isWrongNetwork = isConnected && !!chain && !isSupportedChain(chain.id);

  return {
    address,
    isConnected,
    chain,
    isWrongNetwork,
    nativeBalance,
    connect: openConnectModal,
    disconnect,
    isDisconnecting,
  };
}
