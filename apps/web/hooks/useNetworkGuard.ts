"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { CORE_CHAIN, isCoreChain } from "@/lib/chains";
import { useWallet } from "./useWallet";

export function useNetworkGuard() {
  const { address, chain, isWrongNetwork, connect } = useWallet();
  const { status } = useAccount();
  const { switchChain, isPending, error: switchError } = useSwitchChain();

  // ENH-018: 暴露 wagmi 原始 status 派生的 3 态，供消费者区分 reconnecting 过渡态。
  // 注意 isDisconnected 保留 !address 旧语义（"当前无地址可用"），避免已有 UI 逻辑
  // 隐式翻转；新代码应用 isConnected / isConnecting 精确判定。
  const isConnected = status === "connected";
  const isConnecting = status === "connecting" || status === "reconnecting";

  return {
    /** 钱包已连接且在支持的链上 → 可执行链上操作（登录、Relay 等） */
    canOperate: !!address && !isWrongNetwork,
    /** 钱包已连接且在核心链（BSC）上 → BSC-only 操作（PancakeSwap、Betting） */
    canOperateOnCore: !!address && !isWrongNetwork && !!chain && isCoreChain(chain.id),
    /** 当前是否在核心链（BSC） */
    isOnCoreChain: !!chain && isCoreChain(chain.id),
    /** 已连接但链不对 */
    isWrongNetwork,
    /** 钱包已连接并就绪（wagmi status='connected'） */
    isConnected,
    /** 钱包连接或重连中（wagmi status='connecting' | 'reconnecting'） */
    isConnecting,
    /** 未连接钱包（!address；保留旧语义兼容已有消费者；新代码请用 isConnected / isConnecting） */
    isDisconnected: !address,
    /** 当前链信息 */
    currentChain: chain,
    /** 核心链（BSC） */
    coreChain: CORE_CHAIN,
    /** 是否在指定目标链上 */
    isOnChain: (chainId: number) => !!chain && chain.id === chainId,
    /** 触发切链到任意目标链 */
    switchTo: (chainId: number) => switchChain({ chainId }),
    /** 触发切换到核心链（BSC） — switchTo(CORE_CHAIN.id) 的语义快捷 */
    switchToCore: () => switchChain({ chainId: CORE_CHAIN.id }),
    /** 切链请求进行中 */
    isSwitching: isPending,
    /** 切链失败错误（用户拒绝、钱包不支持等） */
    switchError,
    /** 打开连接弹窗（方便 isDisconnected 态直接调用） */
    connect,
  };
}
