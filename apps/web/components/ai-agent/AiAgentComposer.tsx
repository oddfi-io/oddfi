"use client";

import { useCallback, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpIcon, StopIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

interface AiAgentComposerProps {
  onSend: (text: string) => Promise<unknown> | unknown;
  onAbort: () => void;
  isLoading: boolean;
  placeholder?: string;
}

/**
 * AI 聊天主界面输入框（DD-121 · Figma 6814:124966，740×60 全 pill）。
 *
 * - 容器：bg-primary + rounded-full，背后一层模糊 mint→yellow 渐变辉光（6814:124963）
 * - 右侧 28px 白圆按钮：有文字→Send(↑)，加载中→Stop（红），空→禁用
 * - 设计稿语义是 dictation/mic，V1 复用为 Send 主 CTA（沿用 DD-106 决策）
 */
export function AiAgentComposer({ onSend, onAbort, isLoading, placeholder }: AiAgentComposerProps) {
  const t = useTranslations("aiChat");
  const [value, setValue] = useState("");

  const submit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setValue("");
    await onSend(trimmed);
  }, [onSend, value]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isLoading) submit();
      }
    },
    [isLoading, submit]
  );

  const sendDisabled = !value.trim();

  return (
    <div className="relative w-full max-w-[740px]">
      {/* mint→yellow 渐变辉光（Figma 6814:124963）— 模糊 10 / opacity 50，在 pill 背后渗出形成光晕 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[100px] opacity-50 blur-[10px]"
        // @figma-hardcoded: #28F4D2 / #DCEA42 / #DBEA43 composer-glow gradient — pending design token
        style={{
          backgroundImage:
            "linear-gradient(67.42deg, #28F4D2 1.4%, #DCEA42 71.05%, #DBEA43 98.14%)",
        }}
      />
      {/* pill 本体 */}
      <div className="relative flex h-[60px] items-center gap-2 rounded-[100px] bg-primary p-4">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={placeholder ?? t("composer.placeholder")}
          aria-label="Message input"
          className="h-[18px] flex-1 resize-none self-center border-0 bg-transparent text-[14px] leading-[18px] text-primary placeholder:text-secondary focus:outline-none disabled:cursor-not-allowed"
        />

        {isLoading ? (
          <button
            type="button"
            aria-label="Stop"
            onClick={onAbort}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-fn-red text-static-black transition hover:opacity-90"
          >
            <StopIcon size={18} weight="fill" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Send"
            onClick={submit}
            disabled={sendDisabled}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border-0 transition",
              sendDisabled
                ? "cursor-not-allowed bg-tertiary text-tertiary"
                : "cursor-pointer bg-white text-static-black hover:opacity-90"
            )}
          >
            <ArrowUpIcon size={18} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
}
