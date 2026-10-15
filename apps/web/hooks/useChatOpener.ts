"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { useWalletSheetStore } from "@/stores/walletSheetStore";
import { useAiChatSessionStore, type OpenWithIntentPayload } from "@/stores/aiChatSessionStore";

/**
 * AI Chat 打开入口的统一 gate（替代各入口各自的 isAuthenticated 判断）。
 *
 * 为什么收口到 hook 层而不是 store action：
 *   aiChatSessionStore.mode 既驱动 layout（右栏是否占位）又驱动渲染（AiChatModal portal）。
 *   未登录时直接调 store.open / openWithIntent → mode 被脏写成 "dock" → 右栏占位（"大黑列"）
 *   但 AiChatModal 内 `!isAuthenticated → return null` 拒绝渲染 → 用户看到空黑列。
 *   写 mode 之前 gate 才能保住 store "mode 反映真相" 的不变量；
 *   dock↔float 拖拽切换也走 setMode，那条路径无需 gate，不应放进 store。
 *
 * 对齐既有：`hooks/useRequireWallet.ts` 同款"需要前置条件就阻塞 + 触发连接弹窗"模式。
 */
export interface ChatOpener {
  /** 打开聊天（恢复 lastMode：dock 或 float）；未登录 → toast + 触发钱包连接弹窗。 */
  openChat: () => void;
  /** AI Badge 一键唤起 + 携带分析 intent；未登录 → toast + 触发钱包连接弹窗，intent 丢弃。 */
  openChatWithIntent: (payload: OpenWithIntentPayload) => void;
}

export function useChatOpener(): ChatOpener {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const triggerConnect = useWalletSheetStore((s) => s.triggerConnect);
  const setConnectSource = useWalletSheetStore((s) => s.setConnectSource);
  const open = useAiChatSessionStore((s) => s.open);
  const openWithIntent = useAiChatSessionStore((s) => s.openWithIntent);

  const requireAuth = useCallback((): boolean => {
    if (isAuthenticated) return true;
    toast.info("Sign in to chat with the AI agent");
    setConnectSource("ai-chat");
    triggerConnect();
    return false;
  }, [isAuthenticated, triggerConnect, setConnectSource]);

  const openChat = useCallback(() => {
    if (!requireAuth()) return;
    open();
  }, [requireAuth, open]);

  const openChatWithIntent = useCallback(
    (payload: OpenWithIntentPayload) => {
      if (!requireAuth()) return;
      openWithIntent(payload);
    },
    [requireAuth, openWithIntent]
  );

  return { openChat, openChatWithIntent };
}
