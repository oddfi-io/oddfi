"use client";

import { useEffect, useMemo } from "react";
import { useAccount, useConfig } from "wagmi";
import { useTranslations } from "next-intl";
import MobileBottomSheet from "@/components/ui/MobileBottomSheet";
import { useWalletSheetStore } from "@/stores/walletSheetStore";
import { useAuthStore } from "@/stores/authStore";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import { detectWalletEnv, type WalletEnv } from "@/lib/wallet-env";
import { isUserCanceledMessage, type WalletErrorKind } from "@/lib/wallet-error";
import {
  getWalletOpenLinkForCurrentPage,
  getWalletAppLink,
  type DappBrowserWallet,
} from "@/lib/mobile-wallet-detect";
import { ArrowsClockwiseIcon, ShieldCheckIcon, ArrowSquareOutIcon } from "@phosphor-icons/react";
import {
  WALLETS,
  truncateAddress,
  getLastUsedWalletId,
  isWalletDisabledForTestnet,
  isWalletComingSoon,
} from "./walletConfig";

/* ------------------------------------------------------------------ */
/*  MobileWalletConnectSheet                                           */
/*  H5 wallet connect bottom sheet                                     */
/*  Figma 1064:143172 (select) + 1064:143414 (signing)                 */
/*                                                                     */
/*  View routing:                                                       */
/*  - dapp-browser  → signing (auto-connect on mount)                  */
/*  - external-browser / desktop → select (wallet list)                */
/* ------------------------------------------------------------------ */
interface MobileWalletConnectSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileWalletConnectSheet({ open, onClose }: MobileWalletConnectSheetProps) {
  const config = useConfig();
  const { view, connectingId, isPending, wcDeepLink, handleWalletClick, backToSelect } =
    useWalletConnect({
      open,
      onClose,
    });
  const { address } = useAccount();
  const setSheetOpen = useWalletSheetStore((s) => s.setOpen);
  const t = useTranslations("wallet");
  const loginError = useAuthStore((s) => s.loginError);
  const loginErrorKind = useAuthStore((s) => s.loginErrorKind);
  const isLoggingIn = useAuthStore((s) => s.isLoggingIn);
  const signRequested = useAuthStore((s) => s.signRequested);
  const incrementRetry = useAuthStore((s) => s.incrementRetry);

  // Sync open state to store so MobileBetSlipFAB can hide
  useEffect(() => {
    setSheetOpen(open);
  }, [open, setSheetOpen]);

  // Detect environment on open and auto-connect for dApp browser
  useEffect(() => {
    if (!open) return;

    const env = detectWalletEnv(config.connectors);

    if (env.type === "dapp-browser") {
      // Inside MetaMask/OKX/Coinbase/Binance built-in browser — use injected provider directly.
      // Auto-trigger connect for the detected wallet; skip the selection UI entirely.
      handleWalletClick(env.wallet);
    }
    // external-browser / desktop → show SelectView (default)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Detect environment once per mount — UA and wallet globals are stable for a session.
  const mobileEnv: WalletEnv = useMemo(
    () => detectWalletEnv(config.connectors),
    [config.connectors]
  );

  // 上次成功登录的钱包，开 sheet 时读一次 — localStorage 同步且只在客户端可用
  const lastUsedId = useMemo(() => (open ? getLastUsedWalletId() : undefined), [open]);

  return (
    <MobileBottomSheet open={open} onClose={onClose}>
      {view === "select" ? (
        <SelectView
          t={t}
          onWalletClick={handleWalletClick}
          isPending={isPending}
          connectingId={connectingId}
          lastUsedId={lastUsedId}
        />
      ) : (
        <SigningView
          loginErrorKind={loginErrorKind}
          t={t}
          address={address}
          isPending={isPending || isLoggingIn}
          signRequested={signRequested}
          connectingId={connectingId}
          mobileEnv={mobileEnv}
          wcDeepLink={wcDeepLink}
          onRetry={incrementRetry}
          onReconnect={backToSelect}
          loginError={loginError}
        />
      )}
    </MobileBottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/*  SelectView — wallet list (Figma 1064:143172)                       */
/*  bg-primary sheet, Orbitron title, 5 wallet rows with dividers,     */
/*  terms footer                                                       */
/* ------------------------------------------------------------------ */
interface SelectViewProps {
  t: ReturnType<typeof useTranslations<"wallet">>;
  onWalletClick: (id: string) => void;
  isPending: boolean;
  connectingId: string | null;
  lastUsedId: string | undefined;
}

function SelectView({ t, onWalletClick, isPending, connectingId, lastUsedId }: SelectViewProps) {
  return (
    <div className="flex flex-col gap-[24px] px-[16px] pt-[12px] pb-[40px]">
      {/* Header — Figma 1064:143410 */}
      <div className="flex flex-col gap-[4px]">
        <h2 className="text-[18px] font-bold leading-[32px] text-primary font-orbitron">
          {t("sheetTitle")}
        </h2>
        <p className="text-[14px] leading-[19px] text-secondary">{t("sheetSubtitle")}</p>
      </div>

      {/* Wallet list — Figma 1064:143360 */}
      <div className="flex flex-col bg-secondary rounded-16">
        {WALLETS.map((wallet, i) => (
          <div key={wallet.id}>
            <button
              data-earlybird-gate
              onClick={() => onWalletClick(wallet.id)}
              disabled={
                isPending || isWalletDisabledForTestnet(wallet.id) || isWalletComingSoon(wallet.id)
              }
              className="flex items-center gap-[16px] w-full h-[72px] px-[16px] rounded-12 touch-manipulation active:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {/* Icon — 28×28 rounded-8 */}
              <span className="overflow-clip rounded-8 shrink-0 w-[28px] h-[28px] relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={wallet.icon}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded-8"
                />
              </span>
              {/* Label — 14px medium */}
              <span className="text-[14px] font-medium leading-[19px] text-primary whitespace-nowrap">
                {connectingId === wallet.id ? t("connecting") : wallet.label}
              </span>
              {lastUsedId === wallet.id && (
                <span
                  className="ml-auto h-[20px] px-[6px] py-[2px] rounded-8 text-[10px] font-medium leading-[14px] text-fn-brand flex items-center pointer-events-none"
                  style={{ background: "color-mix(in srgb, var(--fn-brand) 14%, transparent)" }}
                >
                  {t("lastUsed")}
                </span>
              )}
            </button>
            {i < WALLETS.length - 1 && <div className="border-b border-divider" />}
          </div>
        ))}
      </div>

      {/* Terms & Privacy — Figma 1064:143397 */}
      <p className="text-[12px] leading-[18px] text-tertiary">
        {t.rich("termsNotice", {
          terms: (chunks) => <span className="text-brand-default cursor-pointer">{chunks}</span>,
          privacy: (chunks) => <span className="text-brand-default cursor-pointer">{chunks}</span>,
        })}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SigningView — waiting for wallet signature (Figma 1064:143414)      */
/*  Close button, browser mockup, address, description, retry button   */
/* ------------------------------------------------------------------ */
interface SigningViewProps {
  t: ReturnType<typeof useTranslations<"wallet">>;
  address: string | undefined;
  isPending: boolean;
  signRequested: boolean;
  connectingId: string | null;
  mobileEnv: WalletEnv;
  /** WC deep link from display_uri — user taps button to open wallet (H5 external browser only) */
  wcDeepLink: string | null;
  onRetry: () => void;
  /** 签名被拒后点击 "Reconnect" 回到钱包选择视图 */
  onReconnect: () => void;
  loginError: string | null;
  /** BUG-013 v2: 结构化错误分类，优先用于 i18n 文案选择 */
  loginErrorKind: WalletErrorKind | null;
}

function SigningView({
  t,
  address,
  isPending,
  signRequested,
  connectingId,
  mobileEnv,
  wcDeepLink,
  onRetry,
  onReconnect,
  loginError,
  loginErrorKind,
}: SigningViewProps) {
  const hasError = !!loginError;
  const isUserCancel = isUserCanceledMessage(loginError);
  // BUG-013 v2: 优先用结构化 kind 走 i18n 矩阵（避免客户端钱包问题被误显为"服务器问题"）
  const errorTitle = loginErrorKind
    ? t(`error.${loginErrorKind}.title`)
    : isUserCancel
      ? t("signatureCanceled")
      : t("loginFailed");
  const errorDescription = loginErrorKind
    ? t(`error.${loginErrorKind}.description`)
    : isUserCancel
      ? t("signatureCanceledDesc")
      : t("loginFailedDesc");
  // Signing step deep link (after WC connection is established):
  // External browser → getWalletAppLink (open wallet App's WC screen)
  // DApp browser → getWalletOpenLinkForCurrentPage (original deep link logic)
  const signingDeepLink = connectingId
    ? mobileEnv.type === "external-browser"
      ? getWalletAppLink(connectingId)
      : getWalletOpenLinkForCurrentPage(connectingId as DappBrowserWallet)
    : null;

  // WC connection step: display_uri arrived but wallet not yet connected
  const showWcConnectButton = !!wcDeepLink && !address && !loginError;
  const isHttpsLink = wcDeepLink?.startsWith("https://");

  return (
    <div className="flex flex-col gap-[24px] items-center px-[16px] py-[40px]">
      {/* Content — Figma 1064:143607 */}
      <div className="flex flex-col gap-[12px] items-center w-full">
        <BrowserMockup />

        {/* Title & address — Figma 1064:143592 */}
        <div className="flex flex-col gap-[8px] items-center">
          <h2 className="text-[20px] font-bold leading-[28px] text-primary text-center">
            {hasError ? errorTitle : t("signAddress")}
          </h2>
          <div className="flex items-center gap-[8px]">
            <ShieldCheckIcon size={18} className="text-secondary" />
            <span className="text-[16px] leading-[24px] text-primary">
              {address ? truncateAddress(address) : "0x..."}
            </span>
          </div>
        </div>

        {/* Description — Figma 1064:143600 */}
        <p
          className={`text-[12px] font-medium leading-[18px] text-center w-full ${hasError ? "text-fn-red" : "text-tertiary"}`}
        >
          {hasError ? errorDescription : t("signDescription")}
        </p>
      </div>

      {/* ── WC connection step: manual "Open wallet" button ────────────── */}
      {/* display_uri arrived but not yet connected — user taps to open wallet app.         */}
      {/* <a> click = synchronous user gesture → not blocked by Safari/Chrome popup blocker */}
      {showWcConnectButton && (
        <a
          href={wcDeepLink}
          target={isHttpsLink ? "_blank" : undefined}
          rel={isHttpsLink ? "noopener noreferrer" : undefined}
          className="flex items-center justify-center gap-[8px] w-full h-[48px] rounded-12 bg-btn-primary touch-manipulation active:brightness-110 transition-all"
        >
          <ArrowSquareOutIcon size={18} className="text-static-black shrink-0" />
          <span className="text-[14px] font-medium leading-[19px] text-static-black">
            {t("openWalletToConnect")}
          </span>
        </a>
      )}

      {/* Step hint — waiting for display_uri or for dApp browser / PC path */}
      {isPending && !loginError && !signRequested && !showWcConnectButton && (
        <p className="text-[12px] leading-[18px] text-fn-brand text-center w-full px-[4px] animate-pulse">
          {t("openWalletHint")}
        </p>
      )}

      {/* Sign requested: show "Open wallet to sign" deep link button */}
      {signRequested && !loginError && signingDeepLink && (
        <a
          href={signingDeepLink}
          className="flex items-center justify-center gap-[8px] w-full h-[48px] rounded-12 bg-btn-primary touch-manipulation active:brightness-110 transition-all"
        >
          <ArrowSquareOutIcon size={18} className="text-static-black shrink-0" />
          <span className="text-[14px] font-medium leading-[19px] text-static-black">
            {t("returnToWalletSign")}
          </span>
        </a>
      )}

      {/* Fallback pulse hint when sign requested but no deep link (e.g. WalletConnect wallet) */}
      {signRequested && !loginError && !signingDeepLink && (
        <p className="text-[12px] leading-[18px] text-fn-brand text-center w-full px-[4px] animate-pulse">
          {t("openWalletHint")}
        </p>
      )}

      {/* Check wallet / Reconnect button — Figma 297:4034 */}
      <button
        onClick={hasError ? onReconnect : onRetry}
        className="flex items-center justify-center gap-[8px] w-full h-[48px] rounded-12 bg-btn-tertiary shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] touch-manipulation active:brightness-110 transition-all"
      >
        <ArrowsClockwiseIcon
          size={20}
          className={`text-secondary ${!hasError && (isPending || signRequested) ? "animate-spin" : ""}`}
        />
        <span className="text-[14px] font-medium leading-[19px] text-secondary">
          {hasError ? t("reconnect") : t("checkWallet")}
        </span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BrowserMockup — decorative website illustration for signing view   */
/*  CSS-rendered browser window showing oddfi.io                       */
/* ------------------------------------------------------------------ */
function BrowserMockup() {
  return (
    <div className="w-[280px] h-[136px] rounded-12 bg-secondary border border-divider overflow-hidden flex flex-col">
      {/* Address bar — play icon + URL */}
      <div className="flex items-center h-[40px] px-[16px] gap-[8px] border-b border-divider">
        <div className="w-[20px] h-[20px] rounded-full bg-tertiary flex items-center justify-center shrink-0">
          <div className="w-0 h-0 border-l-[6px] border-l-secondary border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-[1px]" />
        </div>
        <span className="text-[11px] text-tertiary truncate">https://oddfi.io</span>
      </div>
      {/* Content placeholder lines */}
      <div className="flex-1 px-[16px] py-[14px] flex flex-col gap-[10px] justify-center">
        <div className="h-[4px] w-full rounded-full bg-tertiary" />
        <div className="h-[4px] w-[65%] rounded-full bg-tertiary" />
      </div>
    </div>
  );
}
