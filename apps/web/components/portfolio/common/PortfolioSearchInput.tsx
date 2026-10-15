"use client";

// ASSETS.md 已查（关键词：SearchInput / SearchBar），无 Portfolio 通用替代品，新建理由：Bet/History 三处重复实现 + 宽度/样式不统一

import { memo, useState } from "react";
import { MagnifyingGlassIcon, ArrowLeftIcon } from "@phosphor-icons/react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasActiveSearch?: boolean;
  onH5OpenChange?: (open: boolean) => void;
}

function PortfolioSearchInput({
  value,
  onChange,
  placeholder,
  hasActiveSearch,
  onH5OpenChange,
}: Props) {
  const [h5Open, setH5Open] = useState(false);

  function openH5() {
    setH5Open(true);
    onH5OpenChange?.(true);
  }

  function closeH5() {
    setH5Open(false);
    onChange("");
    onH5OpenChange?.(false);
  }

  if (h5Open) {
    return (
      // @figma-hardcoded: #111114 fill-input1 — pending design token
      <div className="lg:hidden flex items-center gap-[8px] flex-1 h-[44px] px-[12px] rounded-12 bg-[#111114] border-[0.5px] border-secondary">
        <button
          onClick={closeH5}
          className="flex items-center justify-center size-[24px] min-h-[44px] touch-manipulation"
          style={{ touchAction: "manipulation" }}
          aria-label="Close search"
        >
          <ArrowLeftIcon size={20} className="text-primary" />
        </button>
        <input
          autoFocus
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent border-none outline-none text-[14px] text-primary placeholder:text-tertiary w-full"
        />
      </div>
    );
  }

  return (
    <>
      {/* PC: 搜索输入框 */}
      {/* @figma-hardcoded: #111114 fill-input1 — pending design token */}
      <div className="hidden lg:flex items-center gap-[8px] px-[12px] h-[44px] rounded-12 bg-[#111114] border-[0.5px] border-secondary w-[240px]">
        <MagnifyingGlassIcon size={20} className="text-primary shrink-0" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent border-none outline-none text-[14px] text-primary placeholder:text-tertiary w-full"
        />
      </div>

      {/* H5: 搜索图标按钮 */}
      {/* @figma-hardcoded: #111114 fill-input1 — pending design token */}
      <button
        onClick={openH5}
        style={{ touchAction: "manipulation" }}
        aria-label="Open search"
        className="lg:hidden flex items-center justify-center size-[44px] rounded-12 bg-[#111114] border-[0.5px] border-secondary min-h-[44px]"
      >
        <MagnifyingGlassIcon
          size={20}
          className={hasActiveSearch ? "text-fn-brand" : "text-primary"}
        />
      </button>
    </>
  );
}

export default memo(PortfolioSearchInput);
