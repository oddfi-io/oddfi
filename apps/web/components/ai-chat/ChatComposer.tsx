"use client";

import { useCallback, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { PaperPlaneTiltIcon, StopIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSend: (text: string) => Promise<unknown> | unknown;
  onAbort: () => void;
  isLoading: boolean;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Send 按钮配色（DD-125）：
   *   - "brand"（默认）：薄荷底黑 icon（PC 浮窗，行为不变）
   *   - "white"：白底黑 icon（H5 抽屉，Figma 7235:126572）
   */
  sendVariant?: "brand" | "white";
}

/**
 * 浮窗底部输入条（DD-106 · Figma 6417:119081）。
 *
 * 72px 容器（bg-primary + 顶部 `#212124` 分隔线）；
 * 40px pill 输入框（bg-fill-input-modal · rounded-24 · 12px 占位）+ 40px mint 圆 Send 按钮。
 */
export function ChatComposer({
  onSend,
  onAbort,
  isLoading,
  placeholder,
  disabled,
  sendVariant = "brand",
}: ChatComposerProps) {
  const t = useTranslations("aiChat");
  const defaultPlaceholder = t("composer.placeholder");
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
        if (!isLoading && !disabled) submit();
      }
    },
    [disabled, isLoading, submit]
  );

  const sendDisabled = disabled || (!value.trim() && !isLoading);

  return (
    <div
      // @figma-hardcoded: #212124 line/border-secondary — Figma 6417:119081 顶部分隔线
      className="flex h-[72px] shrink-0 items-center gap-2 border-t border-solid border-[#212124] bg-primary px-4"
    >
      <div
        className="flex h-10 flex-1 items-center rounded-[24px] bg-fill-input-modal pl-3 pr-1"
        // Figma drop-shadow: 10 14 28 rgba(0,0,0,0.12)
        style={{ filter: "drop-shadow(10px 14px 28px rgba(0,0,0,0.12))" }}
      >
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder={placeholder ?? defaultPlaceholder}
          aria-label="Message input"
          className="flex-1 resize-none border-0 bg-transparent text-[12px] leading-[18px] text-primary placeholder:text-secondary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {isLoading ? (
        <button
          type="button"
          aria-label="Stop"
          onClick={onAbort}
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-fn-red text-static-black transition hover:opacity-90"
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
            "flex size-10 shrink-0 items-center justify-center rounded-full border-0 text-static-black transition",
            // 配色变体：white = 白底黑 icon（H5）；brand = 薄荷底黑 icon（PC）
            sendVariant === "white" ? "bg-btn-primary-white" : "bg-fn-brand",
            sendDisabled
              ? "cursor-not-allowed bg-tertiary text-tertiary"
              : "cursor-pointer hover:opacity-90"
          )}
        >
          <PaperPlaneTiltIcon size={18} weight="fill" />
        </button>
      )}
    </div>
  );
}
