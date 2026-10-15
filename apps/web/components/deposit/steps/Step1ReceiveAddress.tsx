"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import StyledQRCode from "@/components/deposit/StyledQRCode";
import { useProxyWallet } from "@/hooks/useProxyWallet";
import { CopySimpleIcon } from "@phosphor-icons/react";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";

export function Step1ReceiveAddress() {
  const t = useTranslations("deposit");
  const { wallet, isLoading, error } = useProxyWallet();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("[Step1ReceiveAddress] Failed to copy address", e);
    }
  }, [wallet]);

  if (error && !wallet && !isLoading) {
    return (
      <div className="flex flex-col items-center py-8 gap-3 text-center">
        <p className="text-sm text-[#ED4C52]">{t("failedToLoad")}</p>
        <p className="text-xs text-[#575966]">{t("pleaseReopen")}</p>
      </div>
    );
  }

  if (!wallet || isLoading) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse mb-4" />
        <div className="w-32 h-4 rounded bg-white/10 animate-pulse mb-2" />
        <div className="w-48 h-3 rounded bg-white/10 animate-pulse" />
      </div>
    );
  }

  const addrStart = wallet.address.slice(0, 4);
  const addrMid = wallet.address.slice(4, -4);
  const addrEnd = wallet.address.slice(-4);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Inner card: QR + address */}
      <div className="border border-[#37393a] rounded-12 w-[300px] overflow-hidden flex flex-col items-center gap-[24px] pb-[24px]">
        {/* Token info header */}
        <div className="bg-fill-input-modal w-full flex flex-col items-center gap-[4px] py-[16px]">
          <div className="flex items-center gap-[8px] justify-center">
            <TokenIconWithChain
              tokenIconUrl={PLATFORM_TOKEN.iconUrl}
              tokenSymbol={PLATFORM_TOKEN_DISPLAY}
              size={24}
              hideChainBadge
            />
            <span className="text-[16px] font-bold text-white leading-[24px]">
              {PLATFORM_TOKEN_DISPLAY}
            </span>
          </div>
          <div className="flex items-start gap-[4px] text-[12px] text-secondary leading-[18px]">
            <span>{t("receiveNetwork")}</span>
            <span>{wallet.network}</span>
          </div>
        </div>

        {/* QR Code — dotted modules + centered BSC logo overlay */}
        <div className="relative size-[180px]">
          <StyledQRCode value={wallet.address} size={180} clearCenterSize={50} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-[30px] rounded-full bg-[#f3ba2f] flex items-center justify-center shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/chains/bsc.svg" alt="BSC" className="w-[30px] h-[30px]" />
            </div>
          </div>
        </div>

        {/* Address + copy */}
        <div className="flex items-center gap-[24px] px-[24px]">
          <div className="flex flex-col gap-[4px] items-start text-[12px]">
            <span className="text-[#5c5d61] leading-[18px]">{t("receiveAddress")}</span>
            <span className="font-medium leading-[18px] break-all">
              <span className="text-brand-default">{addrStart}</span>
              <span className="text-white">{addrMid}</span>
              <span className="text-brand-default">{addrEnd}</span>
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 flex items-center justify-center size-[32px] rounded-full bg-fill-input-modal
                       hover:bg-[#303033] transition-colors cursor-pointer"
            aria-label="Copy address"
          >
            {copied ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <CopySimpleIcon size={16} className="text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Deposit ODD section removed */}
    </div>
  );
}
