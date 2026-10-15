"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { useDepositFlow } from "@/hooks/useDepositFlow";
import { useIsPhone } from "@/hooks/useIsPhone";
import { DepositModal } from "@/components/deposit/DepositModal";
import { WalletConnectModal } from "./WalletConnectModal";
import { MobileWalletConnectSheet } from "./MobileWalletConnectSheet";
import { useWalletSheetStore } from "@/stores/walletSheetStore";
import { useAuthStore, useAuthUIState } from "@/stores/authStore";
import { useConfig } from "wagmi";
import { useDappBrowserConnect } from "@/hooks/useWalletConnect";
import { detectWalletEnv } from "@/lib/wallet-env";
import { toastError, toastWarning } from "@/lib/toast";
import { useEarlyBird } from "@/components/early-bird/EarlyBirdProvider";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";

// PC (Figma I754:54245): bg-btn-primary rounded-12 h-[40px] px-[16px], text 14px semibold
// H5 (Figma 816:63088): bg-btn-primary rounded-8 h-[32px] px-[12px], text 12px medium
const SIGN_UP_CLASS =
  "flex items-center justify-center shrink-0 h-[32px] lg:h-[40px] lg:min-h-[44px] px-[12px] lg:px-[16px] py-[8px] rounded-8 lg:rounded-12 bg-btn-primary text-[12px] lg:text-[14px] font-medium lg:font-semibold text-static-black whitespace-nowrap cursor-pointer border-0 hover:brightness-110 transition-all";

export function WalletConnectButton() {
  const tWallet = useTranslations("wallet");
  const tAuth = useTranslations("auth");
  const { isWrongNetwork, switchToCore, isSwitching, isConnected, isConnecting } =
    useNetworkGuard();
  const deposit = useDepositFlow();
  const isPhone = useIsPhone();

  // 2 态状态机（Round 5）
  const authUIState = useAuthUIState();

  const config = useConfig();
  const { connectDapp } = useDappBrowserConnect();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showMobileSheet, setShowMobileSheet] = useState(false);

  const connectTrigger = useWalletSheetStore((s) => s.connectTrigger);
  const connectSource = useWalletSheetStore((s) => s.connectSource);
  const setConnectSource = useWalletSheetStore((s) => s.setConnectSource);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // 打开钱包连接 UI
  const openConnect = () => {
    const env = detectWalletEnv(config.connectors);
    if (env.type === "dapp-browser") {
      const ok = connectDapp(env.wallet);
      if (ok) return;
    }

    if (isPhone) {
      setShowMobileSheet(true);
    } else {
      setShowConnectModal(true);
    }
  };

  // 关闭时：若来自 ai-agent 且仍未登录，提示连接钱包
  const handleConnectDismissed = () => {
    if (!isAuthenticated && connectSource === "ai-agent") {
      toastWarning(tWallet("connectWalletForAi"));
    }
    setConnectSource(null);
  };

  const closeConnect = () => {
    setShowConnectModal(false);
    handleConnectDismissed();
  };

  // 响应外部触发（如余额不足横幅的 "Deposit now" 在未登录时调用）
  useEffect(() => {
    if (connectTrigger === 0) return;
    openConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectTrigger]);

  // DD-103 早鸟模式：H5 + PC 均改为 Connect 按钮直接挂 data-earlybird-gate，
  // Provider 捕获阶段先于 onClick → 直接弹早鸟 Modal，跳过钱包选择器一层。
  // 这里仍监听 open 状态，防御性关闭可能已开的 wallet 选择器（保留 DD-103 原拦截链）。
  const { open: earlyBirdOpen, isActive: earlyBirdActive } = useEarlyBird();
  useEffect(() => {
    if (earlyBirdActive && earlyBirdOpen) {
      setShowConnectModal(false);
      setShowMobileSheet(false);
    }
  }, [earlyBirdActive, earlyBirdOpen]);

  // BUG-005 Fix C：订阅 loginError 显示 toast。
  // BUG-008 后续修复：原实现弹完 toast 立即 setLoginError(null) "消费一次"，
  // 但这让 SigningPanel 的 hasError 立刻变 false（按钮无法切到 brand 重连样式）。
  // 改用 useRef 去重，loginError 不清，由 user action (backToSelect/closeModal/下一次 performLogin)
  // 在 authStore 内集中清理。这样 ConnectButton toast 与 SigningPanel UI 各取所需。
  const loginError = useAuthStore((s) => s.loginError);
  const lastToastedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!loginError) {
      lastToastedRef.current = null;
      return;
    }
    if (loginError === lastToastedRef.current) return;
    lastToastedRef.current = loginError;
    toastError(loginError);
  }, [loginError]);

  return (
    <>
      <ConnectButton.Custom>
        {({ account, chain, mounted }) => {
          const connected = mounted && account && chain;

          return (
            <div
              {...(!mounted && {
                "aria-hidden": true,
                style: {
                  opacity: 0,
                  pointerEvents: "none" as const,
                  userSelect: "none" as const,
                },
              })}
            >
              {/* 错误链：优先展示，无论登录态 */}
              {connected && isWrongNetwork ? (
                <button
                  onClick={switchToCore}
                  disabled={isSwitching}
                  className={`flex items-center justify-center shrink-0 h-[32px] lg:h-[40px] lg:min-h-[44px] px-[12px] lg:px-[16px] rounded-8 lg:rounded-12 border border-orange-500/40 bg-orange-500/15 font-medium lg:font-semibold text-[12px] lg:text-[14px] text-orange-400 whitespace-nowrap ${isSwitching ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {isSwitching ? tWallet("switching") : tWallet("wrongNetwork")}
                </button>
              ) : authUIState === "ready" && (isConnected || isConnecting) ? (
                /* 状态 2：session 有效且 wagmi 已连接 / 重连中 → Deposit 按钮。
                   reconnecting 乐观视为已连，避免冷启动短暂闪烁
                   （Deposit → Connect Wallet → Deposit）；真正 detached 时
                   wagmi 最终会 settle 到 disconnected，自动落到下面 Connect 分支。
                   DD-113: 认购模式下整段 Deposit 入口隐藏（资金流冻结）。 */
                IS_SUBSCRIPTION_MODE ? null : (
                  <button onClick={deposit.open} className={SIGN_UP_CLASS}>
                    {tWallet("deposit")}
                  </button>
                )
              ) : (
                /* 状态 1：无 session 或 wallet 已 settle 为 disconnected → Connect Wallet。
                   ENH-014：钱包侧主动断开时，session 不清，头部降级为 Connect Wallet
                   提示用户重连；wallet=yes+session=no 的瞬时态由 useAuth Effect 2 强制 disconnect。
                   DD-103：早鸟模式下 Connect 按钮仍打开钱包选择器，钱包卡片自身挂 data-earlybird-gate，
                   选中任一钱包时由 Provider 拦截 → 弹早鸟 Modal。 */
                <button onClick={openConnect} className={SIGN_UP_CLASS}>
                  {isPhone ? tWallet("connectWalletShort") : tAuth("connect_wallet")}
                </button>
              )}
            </div>
          );
        }}
      </ConnectButton.Custom>

      {!isPhone && <WalletConnectModal isOpen={showConnectModal} onClose={closeConnect} />}

      <MobileWalletConnectSheet
        open={showMobileSheet}
        onClose={() => {
          setShowMobileSheet(false);
          handleConnectDismissed();
        }}
      />

      <DepositModal
        isOpen={deposit.state.isOpen}
        onClose={deposit.close}
        step={deposit.state.step}
        selectedAsset={deposit.state.selectedAsset}
        usdAmount={deposit.state.usdAmount}
        txResult={deposit.state.txResult}
        onGoNext={deposit.goNext}
        onGoBack={deposit.goBack}
        onSetStep={deposit.setStep}
        onSelectAsset={deposit.selectAsset}
        onSetUsdAmount={deposit.setUsdAmount}
        onSetTxResult={deposit.setTxResult}
      />
    </>
  );
}
