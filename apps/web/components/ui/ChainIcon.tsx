"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { getChainMeta } from "@/lib/chain-registry";
import { CORE_CHAIN } from "@/lib/chains";

interface ChainIconProps {
  /** 链 ID，缺省为平台主链（BSC） */
  chainId?: number;
  /** 直径（px），默认 20 */
  size?: number;
}

/**
 * 纯链标展示组件——用于「钱包属于哪条链」语义（目标/来源钱包行）。
 * 代币语义请用 TokenIconWithChain。
 */
export function ChainIcon({ chainId = CORE_CHAIN.id, size = 20 }: ChainIconProps) {
  const meta = getChainMeta(chainId);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [meta.iconUrl]);

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-white/10"
      style={{ width: size, height: size }}
    >
      {imgError ? (
        <div
          className="flex h-full w-full items-center justify-center font-semibold text-white/60"
          style={{ fontSize: size * 0.42 }}
        >
          {meta.name[0]}
        </div>
      ) : (
        <Image
          src={meta.iconUrl}
          alt={meta.name}
          width={size}
          height={size}
          sizes={`${size}px`}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  );
}
