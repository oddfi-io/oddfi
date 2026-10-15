"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { CaretDownIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { useRelayTokenList } from "@/hooks/useRelayTokenList";
import type { TokenMeta } from "@/lib/token-registry";

const MAX_INITIAL = 50;
const MAX_SEARCH = 30;

interface BridgeTokenSelectorProps {
  chainId: number;
  value: TokenMeta | null;
  onChange: (token: TokenMeta) => void;
}

export function BridgeTokenSelector({ chainId, value, onChange }: BridgeTokenSelectorProps) {
  const [search, setSearch] = useState("");
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const { data: tokens, isLoading } = useRelayTokenList(chainId);

  const filtered = useMemo(() => {
    if (!tokens) return [];
    const q = search.trim().toLowerCase();
    if (!q) return tokens.slice(0, MAX_INITIAL);
    return tokens
      .filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
      .slice(0, MAX_SEARCH);
  }, [tokens, search]);

  const renderIcon = (token: TokenMeta, size: number) => {
    const key = `${chainId}-${token.address}`;
    if (!token.iconUrl || imgErrors[key]) {
      return (
        <div
          className="flex flex-shrink-0 items-center justify-center rounded-full bg-fill-card2 text-xs font-bold text-secondary"
          style={{ width: size, height: size }}
        >
          {token.symbol[0]}
        </div>
      );
    }
    return (
      <Image
        src={token.iconUrl}
        alt={token.symbol}
        width={size}
        height={size}
        sizes={`${size}px`}
        className="flex-shrink-0 rounded-full"
        onError={() => setImgErrors((prev) => ({ ...prev, [key]: true }))}
        unoptimized
      />
    );
  };

  return (
    <DropdownMenu
      minWidth={220}
      trigger={({ isOpen, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          disabled={isLoading && !tokens}
          className="flex min-h-[44px] items-center gap-[6px] rounded-[8px] bg-fill-card2 px-[10px] transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ touchAction: "manipulation" }}
        >
          {value ? (
            <>
              {renderIcon(value, 20)}
              <span className="text-[14px] font-medium leading-none text-primary">
                {value.symbol}
              </span>
            </>
          ) : (
            <span className="text-[14px] text-tertiary">
              {isLoading ? "Loading..." : "Select token"}
            </span>
          )}
          <CaretDownIcon
            size={14}
            className={`text-tertiary transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col gap-[6px]">
          {/* 搜索框 */}
          <div className="relative px-1">
            <MagnifyingGlassIcon
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary"
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token..."
              className="w-full rounded-[6px] bg-fill-card2 py-[6px] pl-8 pr-3 text-[13px] text-primary placeholder:text-tertiary outline-none"
            />
          </div>

          {/* 代币列表 */}
          <div className="flex max-h-[200px] flex-col overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-[7px]">
                  <div className="size-[18px] animate-pulse rounded-full bg-white/10" />
                  <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12px] text-tertiary">No tokens found</p>
            ) : (
              filtered.map((token) => (
                <DropdownMenuItem
                  key={token.address}
                  selected={value?.address === token.address}
                  onClick={() => {
                    onChange(token);
                    setSearch("");
                    close();
                  }}
                >
                  {renderIcon(token, 18)}
                  <div>
                    <div className="text-[13px] font-medium text-primary">{token.symbol}</div>
                    <div className="text-[11px] text-tertiary">{token.name}</div>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </div>
        </div>
      )}
    </DropdownMenu>
  );
}
