"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { DepositStep } from "@/hooks/useDepositFlow";
import type { TokenMeta } from "@/lib/token-registry";
import { Step0MethodSelect } from "./steps/Step0MethodSelect";
import { Step1ReceiveAddress } from "./steps/Step1ReceiveAddress";
import { Step2SelectAsset } from "./steps/Step2SelectAsset";
import { Step3InputAmount } from "./steps/Step3InputAmount";
import { Step5TransactionConfirm } from "./steps/Step5TransactionConfirm";
import { Step6DepositResult } from "./steps/Step6DepositResult";
import { DepositStepper } from "./DepositStepper";
import type { TxResultData } from "@/stores/depositSheetStore";
import { useProxyWallet } from "@/hooks/useProxyWallet";
import { useWallet } from "@/hooks/useWallet";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTokenPricesApi, lookupPrice } from "@/hooks/useTokenPricesApi";
import { useOddPrice } from "@/hooks/useOddPrice";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_SYMBOL } from "@/lib/platform-token";
import { XIcon } from "@phosphor-icons/react";
import BackIcon from "@/components/icons/BackIcon";
import { mul, formatDisplayAmount } from "@/lib/decimal";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: DepositStep;
  selectedAsset: TokenMeta | null;
  usdAmount: string;
  txResult: TxResultData | null;
  onGoNext: () => void;
  onGoBack: () => void;
  onSetStep: (step: DepositStep) => void;
  onSelectAsset: (asset: TokenMeta) => void;
  onSetUsdAmount: (amount: string) => void;
  onSetTxResult: (data: TxResultData) => void;
}

/**
 * Multi-step Deposit modal.
 * Self-contained modal shell matching Figma design (no generic Modal dependency).
 */
export function DepositModal({
  isOpen,
  onClose,
  step,
  selectedAsset,
  usdAmount,
  txResult,
  onGoNext,
  onGoBack,
  onSetStep,
  onSelectAsset,
  onSetUsdAmount,
  onSetTxResult,
}: DepositModalProps) {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const showBack = step !== "method" && step !== "result";
  const showStepper = step === "amount" || step === "confirm";
  const showHeader = step !== "result";
  const { wallet } = useProxyWallet();
  const { address: eoaAddress } = useWallet();
  const { formatted: proxyBalance } = useTokenBalance(wallet?.address, PLATFORM_TOKEN);
  const { formatted: selectedAssetBalance } = useTokenBalance(
    eoaAddress,
    selectedAsset ?? undefined
  );
  const t = useTranslations("deposit");
  const { data: priceData } = useTokenPricesApi();
  const { data: oddRate } = useOddPrice();
  const proxyUsdBalance = oddRate ? mul(proxyBalance, oddRate) : "0";

  // 按 chainId + address 精确查价，避免 symbol 扁平化导致跨链同名代币取错（如 ARB ETH）
  const assetUsdPrice = selectedAsset
    ? lookupPrice(priceData, selectedAsset.chainId, selectedAsset.address)
    : "0";
  const assetUsdValue = mul(selectedAssetBalance, assetUsdPrice);
  const isPlatformToken = selectedAsset?.symbol === PLATFORM_TOKEN_SYMBOL;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const contentGap = step === "amount" ? "gap-[40px]" : "gap-[24px]";
  // method 步骤与 header 间距保持 40px（Figma 规范）

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={[
          "relative flex flex-col items-center",
          "bg-fill-modal border rounded-16 p-[40px]",
          contentGap,
          "md:w-[440px] md:animate-[slideDown_0.22s_ease-out]",
          "max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:rounded-t-16 max-md:rounded-b-none max-md:animate-[slideUp_0.25s_ease-out]",
        ].join(" ")}
        style={{
          paddingBottom: "max(40px, env(safe-area-inset-bottom))",
        }}
      >
        {/* Close button — visual 24px, touch target 44px */}
        <button
          onClick={onClose}
          className="absolute right-[4px] top-[4px] flex items-center justify-center
                     min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation"
          aria-label="Close"
        >
          <span className="flex items-center justify-center size-[24px] rounded-8 bg-fill-input-modal hover:bg-[#303033] transition-colors">
            <XIcon size={16} className="text-white" />
          </span>
        </button>

        {/* Back button — visual 24px, touch target 44px */}
        {showBack && (
          <button
            onClick={onGoBack}
            className="absolute left-[4px] top-[4px] flex items-center justify-center
                       min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation"
            aria-label="Back"
          >
            <span className="flex items-center justify-center size-[24px] rounded-8 bg-fill-input-modal hover:bg-[#303033] transition-colors">
              <BackIcon size={24} className="text-white" />
            </span>
          </button>
        )}

        {/* Header */}
        {showHeader && (
          <div className="flex flex-col items-center gap-[4px] text-center">
            <p className="text-[18px] font-bold text-white leading-[26px]">
              {step === "receive" ? t("receive") : t("title")}
            </p>
            <div className="flex items-center gap-[4px] text-[14px] text-[#5c5d61] leading-[19px]">
              <span>{t("balance")}</span>
              <span>${formatDisplayAmount(proxyUsdBalance, 2)}</span>
            </div>
          </div>
        )}

        {/* Stepper */}
        {showStepper && <DepositStepper currentStep={step as "amount" | "confirm"} />}

        {/* Step content */}
        {step === "method" && (
          <Step0MethodSelect
            onSelectWallet={() => onSetStep("select")}
            onSelectTransfer={() => onSetStep("receive")}
          />
        )}
        {step === "receive" && <Step1ReceiveAddress />}
        {step === "select" && (
          <Step2SelectAsset
            selectedAsset={selectedAsset}
            onSelect={onSelectAsset}
            onContinue={onGoNext}
          />
        )}
        {step === "amount" && selectedAsset && (
          <Step3InputAmount
            selectedAsset={selectedAsset}
            assetUsdValue={assetUsdValue}
            usdAmount={usdAmount}
            onSetUsdAmount={onSetUsdAmount}
            onContinue={onGoNext}
            isPlatformToken={isPlatformToken}
          />
        )}
        {step === "confirm" && selectedAsset && (
          <Step5TransactionConfirm
            selectedAsset={selectedAsset}
            usdAmount={usdAmount}
            assetUsdPrice={assetUsdPrice}
            onSuccess={onGoNext}
            onTxResult={onSetTxResult}
            isPlatformToken={isPlatformToken}
          />
        )}
        {step === "result" && txResult && (
          <Step6DepositResult
            txResult={txResult}
            onContinueDeposit={() => onSetStep("amount")}
            onViewPortfolio={() => {
              router.push("/portfolio?tab=transactions");
              onClose();
            }}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
