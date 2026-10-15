"use client";

import { memo } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";

interface SearchBarProps {
  onClick?: () => void;
}

export default memo(function SearchBar({ onClick }: SearchBarProps) {
  return (
    <button
      type="button"
      aria-label="Search"
      onClick={onClick}
      className="flex lg:hidden shrink-0 items-center justify-center size-[28px] rounded-8
        bg-secondary border border-divider-light backdrop-blur-[15px]
        transition-colors hover:bg-white/[0.08]"
    >
      <MagnifyingGlassIcon size={16} className="text-primary" />
    </button>
  );
});
