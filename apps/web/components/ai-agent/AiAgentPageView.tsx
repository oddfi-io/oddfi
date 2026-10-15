"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useAiChat } from "@/hooks/useAiChat";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import { useAiAgentStore } from "@/stores/aiAgentStore";
import { PetSprite } from "@/components/codex-pets/PetSprite";
import { ChatClearIcon } from "@/components/icons/ChatClearIcon";
import { ChatMessageList } from "@/components/ai-chat/ChatMessageList";
import { AiAgentComposer } from "./AiAgentComposer";
import { AiAgentQuickChips } from "./AiAgentQuickChips";

/**
 * AI 聊天主界面中央区（DD-121 · Figma 6814:124962 空态 / 6814:125465 中间态）。
 *
 * 布局：
 *   - 空态：吉祥物（当前 codex pet）+ 输入框 + quick chips，整组垂直居中
 *   - 有消息：ChatMessageList 滚动 + 输入框钉底（无 chips）
 *
 * 配置入口由左侧栏二级导航承载（原右上齿轮已下线，避免与 sidebar tab 重复）。
 * 与浮窗共享 aiChatSessionStore.messages（单会话）。
 */
export function AiAgentPageView() {
  const { messages, isLoading, send, abort, retry } = useAiChat();
  const avatarRef = useAiAgentStore((s) => s.config.avatarRef);
  const pendingAutoSend = useAiChatSessionStore((s) => s.pendingAutoSend);
  const consumePendingAutoSend = useAiChatSessionStore((s) => s.consumePendingAutoSend);
  const clearMessages = useAiChatSessionStore((s) => s.clearMessages);
  const isEmpty = messages.length === 0;

  // 清空当前会话（与浮窗 ChatHeader 同款 sonner 二次确认）
  const handleClear = () => {
    const count = messages.length;
    toast.warning("Clear current session?", {
      description: `${count} ${count === 1 ? "message" : "messages"} will be removed`,
      action: {
        label: "Clear",
        onClick: () => {
          clearMessages();
          toast.success("Chat history cleared");
        },
      },
      duration: 5000,
    });
  };

  // DD-107 ENH-2：消费 pendingAutoSend → 真实触发 send（与 AiChatModal 对称）。
  useEffect(() => {
    if (!pendingAutoSend) return;
    const { intent, matchId, matchLabel } = pendingAutoSend;
    consumePendingAutoSend();
    void send(`Analyze ${matchLabel}`, { intent, matchId });
  }, [pendingAutoSend, send, consumePendingAutoSend]);

  return (
    <main className="relative flex min-h-[calc(100svh-64px)] w-full flex-col items-center bg-primary px-6">
      {!isEmpty && (
        <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
          <button
            type="button"
            aria-label="Clear chat history"
            onClick={handleClear}
            className="flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-fill-card1 text-secondary transition hover:text-red"
          >
            <ChatClearIcon size={16} />
          </button>
        </div>
      )}

      {isEmpty ? (
        <div className="flex w-full max-w-[740px] flex-1 flex-col items-center justify-center gap-6 pb-12">
          <PetSprite
            petId={avatarRef}
            size={200}
            mode="idleHoverCycle"
            ariaLabel="OddFi AI Agent"
            className="shrink-0"
          />
          <AiAgentComposer onSend={send} onAbort={abort} isLoading={isLoading} />
          <AiAgentQuickChips onSelect={send} />
        </div>
      ) : (
        <div className="flex w-full max-w-[740px] flex-1 flex-col gap-4 pb-12 pt-6">
          <section className="flex w-full flex-1 flex-col">
            <ChatMessageList messages={messages} onRetry={retry} />
          </section>
          <AiAgentComposer onSend={send} onAbort={abort} isLoading={isLoading} />
        </div>
      )}
    </main>
  );
}
