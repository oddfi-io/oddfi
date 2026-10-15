"use client";

import { useState } from "react";
import Image from "next/image";
import { CaretDownIcon } from "@phosphor-icons/react";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { getChainMeta } from "@/lib/chain-registry";

interface ChainSelectorProps {
  value: number;
  onChange: (chainId: number) => void;
  /** 可选：限定显示的链 ID 列表。默认展示所有 SUPPORTED_CHAINS。 */
  chainIds?: number[];
}

export function ChainSelector({ value, onChange, chainIds }: ChainSelectorProps) {
  const ids = chainIds ?? SUPPORTED_CHAINS.map((c) => c.id);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  const selectedMeta = getChainMeta(value);

  const renderIcon = (chainId: number, size: number) => {
    const meta = getChainMeta(chainId);
    if (imgErrors[chainId]) {
      return (
        <div
          className="flex flex-shrink-0 items-center justify-center rounded-full bg-fill-card2 text-xs font-bold text-secondary"
          style={{ width: size, height: size }}
        >
          {meta.name[0]}
        </div>
      );
    }
    return (
      <Image
        src={meta.iconUrl}
        alt={meta.name}
        width={size}
        height={size}
        sizes={`${size}px`}
        className="flex-shrink-0 rounded-full"
        onError={() => setImgErrors((prev) => ({ ...prev, [chainId]: true }))}
        unoptimized
      />
    );
  };

  return (
    <DropdownMenu
      trigger={({ isOpen, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex min-h-[44px] items-center gap-[6px] rounded-[8px] bg-fill-card2 px-[10px] transition-opacity hover:opacity-90"
          style={{ touchAction: "manipulation" }}
        >
          {renderIcon(value, 20)}
          <span className="text-[14px] font-medium leading-none text-primary">
            {selectedMeta.name}
          </span>
          <CaretDownIcon
            size={14}
            className={`text-tertiary transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      )}
    >
      {({ close }) => (
        <>
          {ids.map((chainId) => {
            const meta = getChainMeta(chainId);
            return (
              <DropdownMenuItem
                key={chainId}
                selected={chainId === value}
                onClick={() => {
                  onChange(chainId);
                  close();
                }}
              >
                {renderIcon(chainId, 18)}
                <div>
                  <div className="text-[13px] font-medium text-primary">{meta.name}</div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </>
      )}
    </DropdownMenu>
  );
}
