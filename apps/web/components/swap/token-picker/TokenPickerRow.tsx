"use client";

import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import type { PickerItem, PickerRowVariant } from "./types";

interface TokenPickerRowProps {
  item: PickerItem;
  variant?: PickerRowVariant;
  selected?: boolean;
  disabled?: boolean;
  onClick?: (item: PickerItem) => void;
}

/**
 * Figma 节点 3372:71085 (default) / 3372:72189 (owned with balance).
 * h-64 · px-8 py-12 · gap-10 · rounded-8
 */
export default function TokenPickerRow({
  item,
  variant = "default",
  selected = false,
  disabled = false,
  onClick,
}: TokenPickerRowProps) {
  const clickable = !disabled && !!onClick;

  return (
    <button
      type="button"
      onClick={() => onClick?.(item)}
      disabled={disabled}
      data-selected={selected || undefined}
      className={[
        "flex h-[64px] w-full items-center justify-between gap-[10px] rounded-8 px-[8px] py-[12px]",
        "text-left transition-colors",
        clickable ? "cursor-pointer hover:bg-white/5" : "cursor-default",
        disabled ? "opacity-40" : "",
        selected ? "bg-white/5" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ touchAction: "manipulation" }}
    >
      {/* 左侧：双图标 + 符号/链 tag / 全称 */}
      <div className="flex min-w-0 items-center gap-[12px]">
        <TokenIconWithChain
          tokenIconUrl={item.tokenIconUrl}
          tokenSymbol={item.symbol}
          chainIconUrl={item.chainIconUrl}
          size={32}
        />

        <div className="flex min-w-0 flex-col items-start justify-center">
          <div className="flex items-center gap-[4px]">
            <span className="text-[14px] font-semibold leading-[19px] text-primary">
              {item.symbol}
            </span>
            <span className="flex h-[20px] items-center justify-center rounded-4 bg-tag-gray px-[4px] text-[12px] leading-[18px] text-secondary">
              {item.chainName}
            </span>
          </div>
          <span className="truncate text-[12px] leading-[18px] text-secondary">{item.name}</span>
        </div>
      </div>

      {/* 右侧：余额 + USD（仅 owned 变体） */}
      {variant === "owned" && item.balance && (
        <div className="flex flex-col items-end whitespace-nowrap">
          <span className="text-[14px] font-semibold leading-[19px] text-primary tabular-nums">
            {item.balance}
          </span>
          {item.usdValue && (
            <span className="text-[12px] font-medium leading-[18px] text-secondary tabular-nums">
              {item.usdValue}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
