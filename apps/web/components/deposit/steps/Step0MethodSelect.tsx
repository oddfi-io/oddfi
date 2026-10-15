"use client";

import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { QrCodeIcon } from "@phosphor-icons/react";
import { useMultiChainPortfolio } from "@/hooks/useMultiChainPortfolio";
import { useConnectedWalletIcon } from "@/hooks/useConnectedWalletIcon";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { formatAmount, add } from "@/lib/decimal";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { IS_TESTNET } from "@/lib/network-mode";

interface Step0MethodSelectProps {
  onSelectWallet: () => void;
  onSelectTransfer: () => void;
}

export function Step0MethodSelect({ onSelectWallet, onSelectTransfer }: Step0MethodSelectProps) {
  const t = useTranslations("deposit");
  const { connector, address } = useAccount();
  const { portfolio, isLoading: portfolioLoading } = useMultiChainPortfolio();
  const { isConnected } = useNetworkGuard();

  // 钱包未连接时禁用"Connected Wallet"入口，不主动调起 RainbowKit modal。
  // Transfer crypto 入口不受影响（代理钱包地址来自 session，不依赖 EOA 连接）。
  const handleSelectWallet = () => {
    if (!isConnected) return;
    onSelectWallet();
  };

  const totalUsd = portfolio.reduce((acc, item) => add(acc, item.usdValue), "0");

  const walletIcon = useConnectedWalletIcon();

  return (
    <div className="flex flex-col gap-[24px] w-full">
      {/* Section 1: Connected Wallet (testnet 下隐藏 — DD-079 仅保留 transfer 入金) */}
      {!IS_TESTNET && (
        <div className="flex flex-col gap-[8px]">
          <p className="text-[12px] font-medium text-secondary leading-[18px]">
            {t("usedConnectedWallet")}
          </p>
          {/* @figma-hardcoded: #212124 bg-tertiary card-bg, #2a2a2d card-bg-hover — pending design token */}
          <button
            onClick={handleSelectWallet}
            disabled={!isConnected}
            className="w-full flex items-center gap-[12px] h-[64px] px-[16px] rounded-12 touch-manipulation transition-colors bg-[#212124] enabled:cursor-pointer enabled:hover:bg-[#2a2a2d] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Wallet icon */}
            <div className="relative shrink-0 size-[24px] rounded-8 overflow-hidden bg-white/10">
              {walletIcon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={walletIcon}
                  alt={connector?.name ?? "Wallet"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-secondary">
                  W
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-[4px] items-start">
              <p className="text-[12px] font-medium text-white leading-[18px]">
                {t("wallet")} ({address ? `...${address.slice(-4)}` : "—"})
              </p>
              <div className="flex items-center gap-[4px]">
                {portfolioLoading ? (
                  <span className="text-[12px] font-medium text-tertiary leading-[18px]">
                    {t("loading")}
                  </span>
                ) : (
                  <>
                    <span className="text-[12px] font-medium text-tertiary leading-[18px]">
                      $ {formatAmount(totalUsd, 2)}
                    </span>
                    {/* 3px dot separator — @figma-hardcoded: #5c5d61 dot-separator — pending design token */}
                    <span
                      className="shrink-0 rounded-full"
                      style={{ width: 3, height: 3, background: "#5c5d61" }}
                    />
                    <span className="text-[12px] font-medium text-tertiary leading-[18px]">
                      {t("instant")}
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Section 2: Other options */}
      <div className="flex flex-col gap-[8px]">
        <p className="text-[12px] font-medium text-secondary leading-[18px]">{t("otherOptions")}</p>
        {/* @figma-hardcoded: #212124 bg-tertiary card-bg, #2a2a2d card-bg-hover — pending design token */}
        <button
          onClick={onSelectTransfer}
          className="w-full flex items-center justify-between h-[64px] px-[16px] rounded-12 cursor-pointer touch-manipulation transition-colors bg-[#212124] hover:bg-[#2a2a2d]"
        >
          {/* Left: icon + info */}
          <div className="flex items-center gap-[12px]">
            <div className="shrink-0 size-[24px] flex items-center justify-center">
              <QrCodeIcon size={24} className="text-white" />
            </div>
            <div className="flex flex-col gap-[4px] items-start">
              <p className="text-[12px] font-medium text-white leading-[18px]">
                {t("transferCrypto")}
              </p>
              <div className="flex items-center gap-[4px]">
                <span className="text-[12px] font-medium text-tertiary leading-[18px]">
                  {t("noLimit")}
                </span>
                {/* 3px dot separator — @figma-hardcoded: #5c5d61 dot-separator — pending design token */}
                <span
                  className="shrink-0 rounded-full"
                  style={{ width: 3, height: 3, background: "#5c5d61" }}
                />
                <span className="text-[12px] font-medium text-tertiary leading-[18px]">
                  {t("instant")}
                </span>
              </div>
            </div>
          </div>

          {/* Right: single ODD coin icon */}
          <div className="flex items-center shrink-0">
            <TokenIconWithChain
              tokenIconUrl={PLATFORM_TOKEN.iconUrl}
              tokenSymbol={PLATFORM_TOKEN_DISPLAY}
              size={24}
              hideChainBadge
            />
          </div>
        </button>
      </div>
    </div>
  );
}
