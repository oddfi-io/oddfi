"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import CaretDownIcon from "@/components/icons/CaretDownIcon";
import { useAccount } from "wagmi";
import { useMultiChainPortfolio } from "@/hooks/useMultiChainPortfolio";
import { useWalletDisplayStore } from "@/stores/walletDisplayStore";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { getChainMeta } from "@/lib/chain-registry";
import { formatAmount, isGt } from "@/lib/decimal";
import { PLATFORM_TOKEN } from "@/lib/platform-token";
import { TokenPortfolioDropdown } from "./TokenPortfolioDropdown";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";

/**
 * 钱包余额触发器 + 代币组合下拉面板
 *
 * 视觉设计来自 main 分支 TopNav.tsx，数据接入 useMultiChainPortfolio。
 * 此组件仅在 ConnectButton 已连接·正确链态下渲染，无需内部判断 canOperate。
 */
interface WalletBalanceWidgetProps {
  onAddFunds?: () => void;
  targetAddress?: `0x${string}`;
}

export function WalletBalanceWidget({ onAddFunds, targetAddress }: WalletBalanceWidgetProps) {
  // ── Platform token balance (single token, not full portfolio) ──
  const { address } = useAccount();
  const { formatted: platformBalance, refetch: refetchPlatformBalance } = useTokenBalance(
    targetAddress ?? address,
    PLATFORM_TOKEN
  );

  // Refresh balance when a swap confirms (signalled via store)
  const balanceVersion = useWalletDisplayStore((s) => s.balanceVersion);
  useEffect(() => {
    if (balanceVersion > 0) refetchPlatformBalance();
  }, [balanceVersion, refetchPlatformBalance]);
  const { chain } = useAccount();
  const chainMeta = useMemo(() => getChainMeta(chain?.id), [chain?.id]);

  const displayBalance = isGt(platformBalance, "0") ? formatAmount(platformBalance, 2) : "0.00";

  // ── Dropdown state (kept for future use, currently disabled) ────
  // To re-enable: set DROPDOWN_ENABLED = true and uncomment portfolio hook
  const DROPDOWN_ENABLED = false;

  const { portfolio, isLoading } = useMultiChainPortfolio();
  const { activeSymbol, setActiveSymbol } = useWalletDisplayStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsHoverDevice(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const startClose = useCallback(() => setIsClosing(true), []);

  const handleAnimationEnd = useCallback(() => {
    if (isClosing) {
      setIsOpen(false);
      setIsClosing(false);
    }
  }, [isClosing]);

  // Touch device: click outside to close
  useEffect(() => {
    if (!DROPDOWN_ENABLED || !isOpen || isHoverDevice) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        startClose();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [DROPDOWN_ENABLED, isOpen, isHoverDevice, startClose]);

  const handleMouseEnter = useCallback(() => {
    if (!DROPDOWN_ENABLED || !isHoverDevice) return;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsOpen(true);
    setIsClosing(false);
  }, [DROPDOWN_ENABLED, isHoverDevice]);

  const handleMouseLeave = useCallback(() => {
    if (!DROPDOWN_ENABLED || !isHoverDevice) return;
    closeTimerRef.current = setTimeout(startClose, 300);
  }, [DROPDOWN_ENABLED, isHoverDevice, startClose]);

  const handleClick = useCallback(() => {
    if (!DROPDOWN_ENABLED) return;
    if (isHoverDevice) return;
    if (isOpen) startClose();
    else setIsOpen(true);
  }, [DROPDOWN_ENABLED, isHoverDevice, isOpen, startClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const handleSelectToken = useCallback(
    (symbol: string) => {
      setActiveSymbol(symbol);
      startClose();
    },
    [setActiveSymbol, startClose]
  );

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger — platform token only */}
      <div
        className="flex items-center flex-shrink-0 bg-[#191b20] border border-[#212329] rounded-12 h-10 px-4 py-2 gap-2 cursor-pointer touch-manipulation"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <TokenIconWithChain
          tokenIconUrl={PLATFORM_TOKEN.iconUrl}
          tokenSymbol={PLATFORM_TOKEN.symbol}
          chainIconUrl={chainMeta.iconUrl}
          mainIconTopOffset={2}
        />

        {/* Balance (no CaretDownIcon when dropdown disabled) */}
        <div className="flex items-center gap-1">
          <span className="font-semibold text-sm leading-5 text-white">{displayBalance}</span>
          {DROPDOWN_ENABLED && (
            <CaretDownIcon
              size={12}
              className={`text-white transition-transform duration-200 ${isOpen && !isClosing ? "rotate-180" : ""}`}
            />
          )}
        </div>

        {/*/!* Plus button *!/*/}
        {/*<button*/}
        {/*  className="flex items-center justify-center flex-shrink-0 bg-fn-brand rounded-full size-6 border-0 cursor-pointer"*/}
        {/*  aria-label="Add funds"*/}
        {/*  onClick={(e) => {*/}
        {/*    e.stopPropagation();*/}
        {/*    onAddFunds?.();*/}
        {/*  }}*/}
        {/*>*/}
        {/*  <Plus size={14} weight="bold" className="text-white" aria-label="add" />*/}
        {/*</button>*/}
      </div>

      {/* Dropdown panel (disabled via DROPDOWN_ENABLED flag) */}
      {DROPDOWN_ENABLED && isOpen && (
        <TokenPortfolioDropdown
          portfolio={portfolio}
          isLoading={isLoading}
          isClosing={isClosing}
          onAnimationEnd={handleAnimationEnd}
          activeSymbol={activeSymbol ?? null}
          onSelectToken={handleSelectToken}
          onAddFunds={onAddFunds}
        />
      )}
    </div>
  );
}
