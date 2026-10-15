"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";

export type TokenPickerSearchSize = "md" | "sm";

interface TokenPickerSearchInputProps {
  /** md=PC (h-44 rounded-12 14px regular) / sm=H5 (h-44 rounded-8 12px medium) */
  size?: TokenPickerSearchSize;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Figma PC 节点 3371:68989 / H5 节点 3376:83708 — "icon btn-40"
 * border-primary · px-12 py-11 · gap-8 · backdrop-blur-15
 * PC: rounded-12 / 14px regular leading-19
 * H5: rounded-8 / 12px medium leading-18
 */
export default function TokenPickerSearchInput({
  size = "md",
  value,
  onChange,
  placeholder = "Search by token symbol or contract address",
  autoFocus = false,
}: TokenPickerSearchInputProps) {
  const isMd = size === "md";

  return (
    <label
      className={[
        "flex items-center gap-[8px] border border-primary px-[12px] py-[11px] backdrop-blur-[15px]",
        "focus-within:border-secondary transition-colors",
        isMd ? "rounded-12" : "rounded-8",
      ].join(" ")}
    >
      <MagnifyingGlassIcon size={20} weight="regular" className="shrink-0 text-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={[
          "min-w-0 flex-1 bg-transparent text-primary outline-none placeholder:text-tertiary",
          isMd
            ? "text-[14px] font-normal leading-[19px]"
            : "text-[12px] font-medium leading-[18px]",
        ].join(" ")}
      />
    </label>
  );
}
