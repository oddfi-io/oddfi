"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ListIcon } from "@phosphor-icons/react";
import { useDevToolsStore } from "@/stores/devToolsStore";
import AvatarIcon from "@/components/icons/AvatarIcon";
import CaretDownIcon from "@/components/icons/CaretDownIcon";
import { WalletConnectButton } from "@/components/wallet/ConnectButton";
import { formatAmount } from "@/lib/decimal";
import { useWallet } from "@/hooks/useWallet";
import { useProxyWallet } from "@/hooks/useProxyWallet";
import { useUserProfile } from "@/hooks/useUserProfile";
import { UserAvatarDropdown } from "@/components/wallet/UserAvatarDropdown";
import UserSettingsModal from "@/components/wallet/UserSettingsModal";
import { useAccount } from "wagmi";
import { useAuthStore } from "@/stores/authStore";
import { useIsPhone } from "@/hooks/useIsPhone";
import MobileMenuSheet from "@/components/layout/MobileMenuSheet";
import { useMobileMenuStore, selectMobileMenuOpen } from "@/stores/mobileMenuStore";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { useTwitterBindResult } from "@/hooks/useTwitterBindResult";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";

// ─── Portfolio + Cash Widget ─────────────────────────────────────────────────
// Figma PC 754:54245: label=text-tertiary 12px, value=green number + white "ODD"
// H5: 同样双列，text-[10px] gap-[8px] 更紧凑

function PortfolioCashWidget() {
  const t = useTranslations("portfolio");
  const { data: accountBalance, isLoading } = useAccountBalance();
  const { canConvert, convert, isUsd } = useCurrencyDisplay();
  const showUsd = isUsd && canConvert;

  const portfolioVal =
    !isLoading && accountBalance?.total_balance != null
      ? formatAmount(
          showUsd ? convert(accountBalance.total_balance) : accountBalance.total_balance,
          2
        )
      : null;

  const cashVal =
    !isLoading && accountBalance?.available_balance != null
      ? formatAmount(
          showUsd ? convert(accountBalance.available_balance) : accountBalance.available_balance,
          2
        )
      : null;

  // DD-146 B14：站内可用 USDT 余额（usdt_available_balance，DB 账本去尾零串）。
  // 与上方 ODD/USD 切换无关：USDT 始终原值展示，缺省（老接口未升级）兜底为 null → 骨架占位。
  const usdtVal =
    !isLoading && accountBalance?.usdt_available_balance != null
      ? formatAmount(accountBalance.usdt_available_balance, 2)
      : null;

  const label = showUsd ? "USD" : PLATFORM_TOKEN_DISPLAY;

  const renderValue = (val: string | null) => (
    <span className="font-semibold">
      {val != null ? (
        <>
          <span className="text-brand-default">
            {showUsd ? "$" : ""}
            {val}
          </span>{" "}
          <span className="text-white">{label}</span>
        </>
      ) : (
        <span className="inline-block w-[72px] h-[14px] lg:h-[16px] rounded-4 bg-white/[0.08] animate-pulse align-middle" />
      )}
    </span>
  );

  return (
    <Link
      href="/portfolio"
      className="flex items-center gap-[8px] lg:gap-[16px] shrink-0 cursor-pointer no-underline px-[8px] py-[4px] rounded-8 transition-colors hover:bg-white/[0.06]"
    >
      <div className="flex flex-col items-center text-[10px] lg:text-[12px] leading-[15px] lg:leading-[18px] whitespace-nowrap">
        <span className="font-normal text-tertiary">{t("title")}</span>
        {renderValue(portfolioVal)}
      </div>
      <div className="flex flex-col items-center text-[10px] lg:text-[12px] leading-[15px] lg:leading-[18px] whitespace-nowrap">
        <span className="font-normal text-tertiary">{t("cash")}</span>
        {renderValue(cashVal)}
      </div>
      {/* DD-146 B14：站内可用 USDT（固定 USDT 标签，不随 ODD/USD 切换） */}
      <div className="flex flex-col items-center text-[10px] lg:text-[12px] leading-[15px] lg:leading-[18px] whitespace-nowrap">
        <span className="font-normal text-tertiary">{t("usdt")}</span>
        <span className="font-semibold">
          {usdtVal != null ? (
            <>
              <span className="text-brand-default">{usdtVal}</span>{" "}
              <span className="text-white">USDT</span>
            </>
          ) : (
            <span className="inline-block w-[72px] h-[14px] lg:h-[16px] rounded-4 bg-white/[0.08] animate-pulse align-middle" />
          )}
        </span>
      </div>
    </Link>
  );
}

// ─── Menu Button ─────────────────────────────────────────────────────────────
// PC (Figma I754:54245;754:54404): bg-[#191b20] border-[#212329] rounded-12 size-[40px] p-[8px]
// H5 (Figma 816:63090): bg-[#191b20] border-[#212329] rounded-8 size-[32px] p-[8px]

function MenuButton({
  onMobileMenuOpen,
  onOpenSettings,
}: {
  onMobileMenuOpen: () => void;
  onOpenSettings: () => void;
}) {
  const isPhone = useIsPhone();
  const { address, disconnect, isDisconnecting } = useWallet();
  const { address: fullAddress } = useAccount();
  const { wallet: proxyWallet } = useProxyWallet();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const displayAddress = fullAddress ?? address ?? "";
  const profileAddress = proxyWallet?.address ?? displayAddress;
  // DD-131：头像仅在「已登录(session 有效)」时显示。不再因「钱包已连接但未鉴权」而显示头像，
  // 否则账户切换自动重登的签名窗口期会出现「头像 + Connect 按钮」并存的混合态。
  const isGuest = !isAuthenticated;
  const { profile } = useUserProfile(isGuest ? undefined : profileAddress);

  // DD-103 续: 长按 5s 弹 DevToolsModal（早鸟模式邀请码 bypass 入口）
  const openDevModal = useDevToolsStore((s) => s.openModal);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const handleLongPressStart = useCallback(() => {
    longPressFiredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      openDevModal();
    }, 5000);
  }, [openDevModal]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const wrapClick = useCallback(
    (next: () => void) => (e: React.MouseEvent) => {
      if (longPressFiredRef.current) {
        e.preventDefault();
        e.stopPropagation();
        longPressFiredRef.current = false;
        return;
      }
      next();
    },
    []
  );

  // H5: plain button → opens full-screen MobileMenuSheet
  // @figma-hardcoded: #191b20 nav-btn-bg, #212329 nav-btn-border, #22242a nav-btn-hover — pending design token
  if (isPhone) {
    return (
      <button
        className="flex items-center justify-center w-[32px] h-[32px] rounded-8 bg-[#191b20] border border-[#212329] hover:bg-[#22242a] transition-colors"
        aria-label="Menu"
        onClick={wrapClick(onMobileMenuOpen)}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: "manipulation" }}
      >
        <ListIcon size={20} weight="bold" className="text-white" />
      </button>
    );
  }

  // PC: UserAvatarDropdown with hover/click behavior
  // @figma-hardcoded: #191b20 nav-btn-bg, #212329 nav-btn-border, #22242a nav-btn-hover — pending design token
  const trigger = ({ onClick }: { onClick: () => void }) =>
    isGuest ? (
      <button
        className="flex items-center justify-center w-[40px] h-[40px] min-h-[44px] rounded-12 bg-[#191b20] border border-[#212329] hover:bg-[#22242a] transition-colors"
        aria-label="Menu"
        onClick={wrapClick(onClick)}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: "manipulation" }}
      >
        <ListIcon size={20} weight="bold" className="text-white" />
      </button>
    ) : (
      <button
        className="flex items-center gap-[6px] cursor-pointer border-0 bg-transparent p-0 min-h-[44px] touch-manipulation"
        aria-label="User menu"
        onClick={wrapClick(onClick)}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        <AvatarIcon address={displayAddress} size={40} />
        <CaretDownIcon size={14} className="text-secondary" />
      </button>
    );

  return (
    <UserAvatarDropdown
      address={isGuest ? undefined : displayAddress}
      profileAddress={isGuest ? undefined : profileAddress}
      displayName={profile?.username || undefined}
      onDisconnect={isGuest ? undefined : disconnect}
      onOpenSettings={isGuest ? undefined : onOpenSettings}
      isDisconnecting={isDisconnecting}
      guestMode={isGuest}
      renderTrigger={trigger}
    />
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function TopNavActions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mobileMenuOpen = useMobileMenuStore(selectMobileMenuOpen);
  const setMobileMenuOpen = useMobileMenuStore((s) => s.setOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // DD-148：推特 OAuth 回跳结果处理（受控开 Settings modal + 失效 twitter 查询）。
  // 登录态门控在 hook 内（登出态仅 toast，不开 modal）。
  useTwitterBindResult({ onBound: () => setSettingsOpen(true) });

  // Profile address — same fallback chain as MenuButton / MobileMenuSheet.
  const { address } = useWallet();
  const { address: fullAddress } = useAccount();
  const { wallet: proxyWallet } = useProxyWallet();
  const profileAddress = proxyWallet?.address ?? fullAddress ?? address ?? "";

  return (
    <>
      <div className="flex items-center gap-[8px] lg:gap-[16px] shrink-0">
        {/* DD-113: 认购模式下隐藏 Portfolio / Cash 区，所有链上余额操作冻结 */}
        {isAuthenticated && !IS_SUBSCRIPTION_MODE && <PortfolioCashWidget />}
        <WalletConnectButton />
        <MenuButton
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>
      <MobileMenuSheet
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onOpenSettings={() => {
          setMobileMenuOpen(false);
          setSettingsOpen(true);
        }}
      />
      <UserSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        address={profileAddress}
      />
    </>
  );
}
