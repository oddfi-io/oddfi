"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ChatBubble } from "./ChatBubble";
import type { ChatMsg } from "@/stores/aiChatSessionStore";

interface ChatMessageListProps {
  messages: ChatMsg[];
  onRetry?: (id: string) => void;
  /**
   * H5 悬浮玻璃 header 让位（DD-135 · Figma 7973:127858）：header 以 absolute 浮在本列表上方，
   * padding 须加在滚动容器**内部**（pt 40px header + 24px 原间距），消息才能滚到玻璃按钮背后。
   * PC AiChatModal 不传，保持原 pt-6。
   */
  topInset?: boolean;
}

export function ChatMessageList({ messages, onRetry, topInset = false }: ChatMessageListProps) {
  const t = useTranslations("aiChat");
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-primary text-[12px] leading-[18px] text-[#6b7785]">
        {t("empty")}
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      data-scroll-content
      className={`flex flex-1 flex-col overflow-y-auto bg-primary ${topInset ? "pt-[64px]" : "pt-6"}`}
    >
      {/* 日期分隔（Figma 6417:119079）— 12px / 18 行高 / #6b7785 居中 */}
      {/* @figma-hardcoded: #6b7785 date-divider — pending design token */}
      <div className="mb-3 text-center text-[12px] leading-[18px] text-[#6b7785]">
        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      {messages.map((m) => (
        <ChatBubble key={m.id} message={m} onRetry={onRetry} />
      ))}
    </div>
  );
}
