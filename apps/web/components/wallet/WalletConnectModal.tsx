"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/authStore";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import { isUserCanceledMessage, type WalletErrorKind } from "@/lib/wallet-error";
import { ArrowRightIcon, ArrowsClockwiseIcon, WalletIcon, XIcon } from "@phosphor-icons/react";
import {
  WALLETS,
  truncateAddress,
  getLastUsedWalletId,
  isWalletDisabledForTestnet,
  isWalletComingSoon,
} from "./walletConfig";

/** 右侧宣传图开关 — 设计已激活，图片由设计师提供 */
const SHOW_PROMO_IMAGE = true;

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const t = useTranslations("wallet");
  const [mounted, setMounted] = useState(false);
  const { view, connectingId, isPending, needsWalletApproval, handleWalletClick, backToSelect } =
    useWalletConnect({
      open: isOpen,
      onClose,
    });
  const overlayRef = useRef<HTMLDivElement>(null);
  const { address } = useAccount();
  const isLoggingIn = useAuthStore((s) => s.isLoggingIn);
  const loginError = useAuthStore((s) => s.loginError);
  const loginErrorKind = useAuthStore((s) => s.loginErrorKind);
  const signRequested = useAuthStore((s) => s.signRequested);
  const incrementRetry = useAuthStore((s) => s.incrementRetry);

  // 步骤推导：两步（连接+签名）vs 一步（仅签名）
  const totalSteps = needsWalletApproval ? 2 : 1;
  const currentStep = totalSteps === 2 && signRequested ? 2 : 1;

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

  const lastUsedId = getLastUsedWalletId();

  // 钱包按 3 行 × 2 列分组（telegram 占首位）
  const walletRows: Array<readonly (typeof WALLETS)[number][]> = [
    WALLETS.slice(0, 2),
    WALLETS.slice(2, 4),
    WALLETS.slice(4, 6),
  ];

  return createPortal(
    /* ── Overlay: Figma 6040:113329 — backdrop-blur(8px) + rgba(4,6,12,0.7) ── */
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        background: "rgba(4,6,12,0.7)",
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Connect wallet"
    >
      {view === "signing" ? (
        /* ── Signing Modal: standalone card (Figma 291:14748 / 291:14301) ── */
        <SigningPanel
          loginErrorKind={loginErrorKind}
          address={address}
          isPending={isPending || isLoggingIn}
          signRequested={signRequested}
          loginError={loginError}
          totalSteps={totalSteps}
          currentStep={currentStep}
          onClose={onClose}
          onRetry={incrementRetry}
          onReconnect={backToSelect}
        />
      ) : (
        /* ── Wallet Select: Figma 6040:113330 ── */
        /*    Desktop: 713×454 容器，主面板 480 + 右侧装饰 302（叠加 68px）  */
        /*    Mobile : 主面板全宽，装饰图隐藏                                 */
        <div className="md:animate-[slideDown_0.22s_ease-out] max-md:animate-[slideUp_0.25s_ease-out] max-md:w-full max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0">
          <div
            className="relative md:h-[454px] md:w-[713px] max-md:w-full"
            // 容器本身无 bg / 无 border，仅作定位框；装饰区与主面板各自带 bg
          >
            {/* ── Right deco panel: Figma 6040:113347 ── */}
            {/*    302×454, 叠加在主面板右侧 68px；max-md 隐藏              */}
            {SHOW_PROMO_IMAGE && (
              <div className="hidden md:block absolute top-0 right-0 h-full w-[302px] overflow-hidden rounded-tr-16 rounded-br-16 z-0">
                <Image
                  src="/images/wallet-connect-right-v2.png"
                  alt=""
                  fill
                  sizes="302px"
                  className="object-cover pointer-events-none"
                  aria-hidden="true"
                />
                {/* "Start Prediction" 装饰 CTA — Figma 6040:114204 / 纯视觉，不可点击 */}
                <div
                  className="absolute left-[95px] top-[84px] flex items-center gap-[3px] pointer-events-none select-none"
                  aria-hidden="true"
                >
                  <span
                    className="text-[18px] leading-[28px] font-bold text-white whitespace-nowrap"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    {t("startPrediction")}
                  </span>
                  <ArrowRightIcon size={22} weight="bold" className="text-white" />
                </div>
              </div>
            )}

            {/* ── Left/main panel: Figma 6040:113331 ── */}
            {/*    480×454, bg-secondary, border-secondary, rounded-16, p-40, gap-32 */}
            <div className="relative z-10 bg-secondary border border-secondary flex flex-col gap-[32px] items-start p-[40px] shrink-0 md:w-[480px] md:h-[454px] rounded-16 max-md:w-full max-md:p-6 max-md:rounded-t-16 max-md:rounded-b-none">
              {/* Close button — 右上角 */}
              <button
                onClick={onClose}
                className="absolute top-[4px] right-[4px] flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation"
                aria-label="Close"
              >
                {/* @figma-hardcoded: #303033 close-btn-hover — pending design token */}
                <span className="flex items-center justify-center size-[24px] rounded-8 bg-fill-input-modal hover:bg-[#303033] transition-colors">
                  <XIcon size={16} className="text-primary" weight="bold" />
                </span>
              </button>

              {/* Header: Figma 6040:113332 */}
              <div className="flex flex-col gap-[12px] items-start text-primary">
                <h2
                  className="text-[24px] tracking-[-0.24px] leading-[32px] font-bold"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  {t("modalTitle")}
                </h2>
                <p className="text-[16px] leading-[24px] font-normal">{t("modalSubtitle")}</p>
              </div>

              {/* Wallet grid: Figma 6040:113335 — 3 行 × 2 列横向卡片 */}
              <div className="flex flex-col gap-[16px] items-start w-full">
                {walletRows.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex gap-[16px] items-start w-full">
                    {row.map((w) => (
                      <WalletCard
                        key={w.id}
                        wallet={w}
                        isConnecting={connectingId === w.id}
                        isLastUsed={lastUsedId === w.id}
                        disabled={
                          isPending || isWalletDisabledForTestnet(w.id) || isWalletComingSoon(w.id)
                        }
                        onClick={() => handleWalletClick(w.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Terms: Figma 6040:113346 */}
              <p className="text-[12px] leading-[18px] font-normal text-tertiary">
                {t("termsPrefix")}{" "}
                <span className="text-brand-default cursor-pointer hover:underline">
                  {t("termsOfService")}
                </span>{" "}
                {t("and")}{" "}
                <span className="text-brand-default cursor-pointer hover:underline">
                  {t("privacyPolicy")}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/*  WalletCard — Figma 6040:113337 等                                  */
/*  横向布局: 28px icon + 14px label, gap-8, h-64, px-24 py-16         */
/*  bg-tertiary (#212124), rounded-12                                  */
/* ------------------------------------------------------------------ */
interface WalletCardProps {
  wallet: (typeof WALLETS)[number];
  isConnecting: boolean;
  isLastUsed?: boolean;
  disabled: boolean;
  onClick: () => void;
}

function WalletCard({ wallet, isConnecting, isLastUsed, disabled, onClick }: WalletCardProps) {
  const t = useTranslations("wallet");
  return (
    <button
      data-earlybird-gate
      onClick={onClick}
      disabled={disabled}
      className="relative bg-tertiary hover:bg-btn-tertiary-hover transition-colors flex flex-[1_0_0] gap-[8px] items-center min-w-px h-[64px] px-[24px] py-[16px] rounded-12 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-tertiary touch-manipulation"
    >
      {isLastUsed && (
        <span
          className="absolute top-[8px] right-[8px] h-[20px] px-[6px] py-[2px] rounded-8 text-[10px] font-medium leading-[14px] text-fn-brand pointer-events-none flex items-center"
          style={{ background: "color-mix(in srgb, var(--fn-brand) 14%, transparent)" }}
        >
          {t("lastUsed")}
        </span>
      )}
      {/* Icon: 28×28 rounded-8 — SVG bg baked in */}
      <span className="overflow-clip rounded-8 shrink-0 w-[28px] h-[28px] relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wallet.icon}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded-8"
        />
      </span>
      {/* Label: 14px medium */}
      <span className="text-[14px] font-medium leading-[18px] text-primary whitespace-nowrap">
        {isConnecting ? t("connecting") : wallet.label}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  SigningPanel — standalone centered modal (Figma 291:14748)        */
/* ------------------------------------------------------------------ */
interface SigningPanelProps {
  address: string | undefined;
  isPending: boolean;
  signRequested: boolean;
  loginError: string | null;
  /** BUG-013 v2: 结构化错误分类，优先用于 i18n 文案选择 */
  loginErrorKind: WalletErrorKind | null;
  /** Total login steps: 2 = connect + sign, 1 = sign only */
  totalSteps: 1 | 2;
  /** Current step (1 or 2) */
  currentStep: 1 | 2;
  onClose: () => void;
  onRetry: () => void;
  /** 签名被拒后点击 "Reconnect" 回到钱包选择视图 */
  onReconnect: () => void;
}

function SigningPanel({
  address,
  isPending,
  signRequested,
  loginError,
  loginErrorKind,
  totalSteps,
  currentStep,
  onClose,
  onRetry,
  onReconnect,
}: SigningPanelProps) {
  const t = useTranslations("wallet");
  const hasError = !!loginError;
  const isUserCancel = isUserCanceledMessage(loginError);
  const isConnectStep = totalSteps === 2 && currentStep === 1;
  // BUG-013 v2: 优先用结构化 kind 走 i18n 矩阵（避免客户端钱包问题被显示为"服务器问题"）；
  // kind 为 null 时（旧字符串路径 / 边界） fallback 到旧 isUserCancel 判断
  const title = hasError
    ? loginErrorKind
      ? t(`error.${loginErrorKind}.title`)
      : isUserCancel
        ? t("signatureCanceled")
        : t("loginFailed")
    : isConnectStep
      ? t("connectYourWallet")
      : t("signWithAddress");
  const description = hasError
    ? loginErrorKind
      ? t(`error.${loginErrorKind}.description`)
      : isUserCancel
        ? t("signatureCanceledDesc")
        : t("loginFailedDesc")
    : isConnectStep
      ? t("approveConnection")
      : t("confirmSignature");
  const buttonLabel = hasError
    ? t("reconnect")
    : totalSteps === 2
      ? t("checkWalletStep", { current: currentStep, total: totalSteps })
      : t("checkWallet");
  const buttonHandler = hasError ? onReconnect : onRetry;
  const spinning = !hasError && (isPending || (signRequested && !loginError));

  return (
    /* Card: Figma 291:14748 — bg fill/modal, border, 16px radius, 40px padding */
    <div className="relative bg-fill-modal border border-divider rounded-16 p-[40px] flex flex-col gap-[24px] items-center w-[440px] max-md:w-[calc(100vw-32px)] md:animate-[slideDown_0.22s_ease-out]">
      {/* Close button: absolute top-right (Figma 297:7653) — 44px touch target, 24px visual */}
      <button
        onClick={onClose}
        className="absolute top-[4px] right-[4px] flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation"
      >
        {/* @figma-hardcoded: #303033 close-btn-hover — pending design token */}
        <span className="flex items-center justify-center size-[24px] rounded-8 bg-fill-input-modal hover:bg-[#303033] transition-colors">
          <XIcon size={16} className="text-primary" weight="bold" />
        </span>
      </button>

      {/* Browser mockup: Figma 291:14788 — 320×155 */}
      <div className="w-[320px] h-[155px] rounded-12 bg-primary border border-divider overflow-hidden flex flex-col shrink-0">
        <div className="flex items-center h-[32px] px-[12px] gap-[6px] border-b border-divider">
          <div className="w-[6px] h-[6px] rounded-full bg-fn-red" />
          <div className="w-[6px] h-[6px] rounded-full bg-fn-yellow" />
          <div className="w-[6px] h-[6px] rounded-full bg-fn-green" />
        </div>
        <div className="flex items-center h-[40px] px-[16px] gap-[8px] border-b border-divider">
          <div className="w-[20px] h-[20px] shrink-0">
            <Image
              src="/images/logo-icon.svg"
              alt=""
              width={20}
              height={20}
              sizes="20px"
              className="w-full h-full"
            />
          </div>
          <span className="text-[11px] text-secondary truncate">https://oddfi.io</span>
        </div>
        <div className="flex-1 px-[16px] py-[14px] flex flex-col gap-[10px] justify-center">
          <div className="h-[4px] w-full rounded-full bg-secondary" />
          <div className="h-[4px] w-[65%] rounded-full bg-secondary" />
        </div>
      </div>

      {/* Title & address */}
      <div className="flex flex-col gap-[8px] items-center">
        <h2
          className="text-[24px] font-bold leading-[32px] tracking-[-0.24px] text-primary text-center"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          {title}
        </h2>
        <div className="flex items-center gap-[8px]">
          <WalletIcon size={20} className="text-secondary" />
          <span className="text-[18px] leading-[26px] text-primary">
            {address ? truncateAddress(address) : "0x..."}
          </span>
        </div>
      </div>

      {/* Description */}
      <p
        className={`text-[14px] leading-[19px] text-center ${hasError ? "text-fn-red" : "text-tertiary"}`}
      >
        {description}
      </p>

      {/* Check wallet / Reconnect button: Figma 297:4034
          hasError 时切到 brand 主 CTA 视觉，与项目"充值/Connect"按钮一致，强调重试动作 */}
      <button
        onClick={buttonHandler}
        className={`flex items-center justify-center gap-[8px] w-full h-[48px] rounded-12 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] hover:brightness-110 transition-all ${
          hasError ? "bg-fn-brand" : "bg-btn-tertiary"
        }`}
      >
        <ArrowsClockwiseIcon
          size={20}
          className={`${hasError ? "text-static-black" : "text-secondary"} ${
            spinning ? "animate-spin" : ""
          }`}
        />
        <span
          className={`text-[14px] font-medium leading-[19px] ${
            hasError ? "text-static-black" : "text-secondary"
          }`}
        >
          {buttonLabel}
        </span>
      </button>
    </div>
  );
}
