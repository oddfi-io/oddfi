"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import {
  PLATFORM_TOKEN,
  PLATFORM_TOKEN_SYMBOL,
  PLATFORM_TOKEN_DISPLAY,
} from "@/lib/platform-token";

/** 平台币识别 — symbol 命中链上 symbol 或 UI 展示 symbol 即视为平台币 */
function isPlatformToken(symbol: string): boolean {
  return symbol === PLATFORM_TOKEN_SYMBOL || symbol === PLATFORM_TOKEN_DISPLAY;
}

interface TokenIconWithChainProps {
  tokenIconUrl?: string;
  tokenSymbol: string;
  /** 链标 URL — `hideChainBadge` 为 true 时可省略 */
  chainIconUrl?: string;
  /** Main icon diameter in px (default 24) */
  size?: number;
  /**
   * Top offset for main icon (Figma: 2px at size=24).
   * Grows the container so the main icon's visual center aligns with
   * adjacent text when flex-centered. Badge hangs below-right.
   */
  mainIconTopOffset?: number;
  /** 隐藏右下角链标，容器尺寸严格等于 size × size */
  hideChainBadge?: boolean;
}

export function TokenIconWithChain({
  tokenIconUrl,
  tokenSymbol,
  chainIconUrl,
  size = 24,
  mainIconTopOffset = 0,
  hideChainBadge = false,
}: TokenIconWithChainProps) {
  const [tokenImgError, setTokenImgError] = useState(false);
  const [chainImgError, setChainImgError] = useState(false);

  // 平台币图标走 PLATFORM_TOKEN 单一数据源，调用方传不传 tokenIconUrl 都强制覆盖
  const resolvedTokenIconUrl = isPlatformToken(tokenSymbol) ? PLATFORM_TOKEN.iconUrl : tokenIconUrl;

  useEffect(() => {
    setTokenImgError(false);
  }, [resolvedTokenIconUrl]);

  const badgeSize = Math.round(size * 0.58);

  // Figma exact: 28×30 at size=24, offset=2. Derive proportionally.
  // hideChainBadge: 容器严格 size × size，不为 badge 留空间
  const containerW = hideChainBadge
    ? size
    : mainIconTopOffset > 0
      ? size + Math.round(size / 6) // 24+4=28
      : size + badgeSize * 0.3;
  const containerH = hideChainBadge
    ? size
    : mainIconTopOffset > 0
      ? mainIconTopOffset + size + Math.round(badgeSize * 0.29) // 2+24+4=30
      : size + badgeSize * 0.25;

  return (
    <div
      className="relative flex-shrink-0 overflow-visible"
      style={{ width: containerW, height: containerH }}
    >
      {tokenImgError || !resolvedTokenIconUrl ? (
        <div
          className="absolute left-0 rounded-full bg-white/10 flex items-center justify-center font-semibold text-white/60"
          style={{ width: size, height: size, fontSize: size * 0.42, top: mainIconTopOffset }}
        >
          {tokenSymbol[0]}
        </div>
      ) : (
        <Image
          src={resolvedTokenIconUrl}
          alt={tokenSymbol}
          width={size}
          height={size}
          sizes={`${size}px`}
          className="absolute left-0 rounded-full"
          style={{ top: mainIconTopOffset }}
          onError={() => setTokenImgError(true)}
        />
      )}

      {hideChainBadge ? null : chainImgError || !chainIconUrl ? (
        <div
          className="absolute bottom-0 right-0 rounded-full bg-white/10"
          style={{ width: badgeSize, height: badgeSize }}
        />
      ) : (
        <Image
          src={chainIconUrl}
          alt="chain"
          width={badgeSize}
          height={badgeSize}
          sizes={`${badgeSize}px`}
          className="absolute bottom-0 right-0 rounded-full"
          onError={() => setChainImgError(true)}
        />
      )}
    </div>
  );
}
