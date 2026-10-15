"use client";

import { ArrowsOutIcon, ArrowSquareOutIcon, XIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { PetSprite } from "@/components/codex-pets/PetSprite";
import { ChatClearIcon } from "@/components/icons/ChatClearIcon";
import { useAiAgentStore } from "@/stores/aiAgentStore";

interface ChatHeaderProps {
  onClose: () => void;
  /** DD-107 ENH：清空当前会话消息（仅前端 localStorage + store）。无 messages 时不展示 */
  onClear?: () => void;
  hasMessages?: boolean;
  /** DD-122：最大化 — 跳全屏 /ai-agent 页 + 关闭浮窗（同 tab） */
  onMaximize?: () => void;
  /** DD-122：新窗口打开 — `window.open('/ai-agent', '_blank')`，浮窗保留 */
  onOpenNewWindow?: () => void;
}

/**
 * 浮窗顶部 Header（DD-106 · DD-122 4-icon 改版 · Figma 7229:103351）。
 *
 * 64px 高，三段：avatar 32 mint 圆 · 标题双行 · 右上 4-icon 组（清理/放大/新窗口/关闭）。
 * 拖拽锚点统一移至顶部居中由 AiChatModal 渲染，header 不再承载 dock 左侧 6-dot。
 */
export function ChatHeader({
  onClose,
  onClear,
  hasMessages,
  onMaximize,
  onOpenNewWindow,
}: ChatHeaderProps) {
  const t = useTranslations("aiChat");
  const avatarRef = useAiAgentStore((s) => s.config.avatarRef);
  return (
    <div
      className="flex h-16 shrink-0 items-center gap-3 border-b border-solid px-4 pb-[13px] pt-3"
      // @figma-hardcoded: #1f2832 header-bottom-divider — pending design token
      style={{ borderBottomColor: "#1f2832" }}
    >
      {/* Avatar 32×32 mint 圆 + 当前 codex-pet 静态预览（跟 AI 配置同步） */}
      <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-fn-brand">
        <PetSprite petId={avatarRef} size={32} mode="static" ariaLabel="AI Agent" />
      </div>

      {/* 标题双行 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13.5px] font-semibold leading-[20.25px] text-primary">AI Agent</span>
        <span className="flex items-center gap-[10px] text-[11.5px] leading-[17.25px] text-[#6b7785]">
          {/* @figma-hardcoded: #6b7785 header-subtext — pending design token */}
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-fn-brand" />
          {t("header.status")}
        </span>
      </div>

      {/* 右上 4-icon 组 — 清理 / 放大 / 新窗口 / 关闭。不参与拖拽。 */}
      <div className="flex shrink-0 items-center gap-3" onMouseDown={(e) => e.stopPropagation()}>
        {hasMessages && onClear && (
          <button
            type="button"
            aria-label="Clear chat history"
            title="Clear"
            onClick={onClear}
            className="flex size-5 cursor-pointer items-center justify-center border-0 bg-transparent text-secondary transition hover:text-red"
          >
            <ChatClearIcon size={18} />
          </button>
        )}
        {onMaximize && (
          <button
            type="button"
            aria-label="Maximize"
            title="Open in full screen"
            onClick={onMaximize}
            className="flex size-5 cursor-pointer items-center justify-center border-0 bg-transparent text-secondary transition hover:text-primary"
          >
            <ArrowsOutIcon size={20} />
          </button>
        )}
        {onOpenNewWindow && (
          <button
            type="button"
            aria-label="Open in new window"
            title="Open in new tab"
            onClick={onOpenNewWindow}
            className="flex size-5 cursor-pointer items-center justify-center border-0 bg-transparent text-secondary transition hover:text-primary"
          >
            <ArrowSquareOutIcon size={20} />
          </button>
        )}
        <button
          type="button"
          aria-label="Close"
          title="Close"
          onClick={onClose}
          className="flex size-5 cursor-pointer items-center justify-center border-0 bg-transparent text-secondary transition hover:text-primary"
        >
          <XIcon size={20} />
        </button>
      </div>
    </div>
  );
}
