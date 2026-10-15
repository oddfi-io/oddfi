"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  CircleNotchIcon,
  CurrencyCircleDollarIcon,
  QuestionIcon,
  FileTextIcon,
  ScalesIcon,
  CaretRightIcon,
  CaretLeftIcon,
  CopyIcon,
  CheckIcon,
  SunIcon,
  MoonIcon,
} from "@phosphor-icons/react";
import GlobeCustomIcon from "@/components/icons/GlobeCustomIcon";
import CaretDownIcon from "@/components/icons/CaretDownIcon";
import { useCurrencyStore, selectCurrency } from "@/stores/currencyStore";
import type { DisplayCurrency } from "@/stores/currencyStore";
import { useThemeStore, selectTheme } from "@/stores/themeStore";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import AvatarIcon from "@/components/icons/AvatarIcon";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";

const LANG_OPTIONS: { code: Locale; label: string; flag: string }[] = [
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

interface UserAvatarDropdownProps {
  address?: string;
  /** 展示在个人中心头部的地址（通常为代理钱包地址），未传时回退到 address */
  profileAddress?: string;
  displayName?: string;
  onDisconnect?: () => void;
  onAddFunds?: () => void;
  /** 点击下拉顶部「头像 + 名字 + 地址」区域触发；未传时该区域不可点 */
  onOpenSettings?: () => void;
  isDisconnecting?: boolean;
  guestMode?: boolean;
  renderTrigger?: (props: {
    isOpen: boolean;
    isDisconnecting: boolean;
    onClick: () => void;
  }) => React.ReactNode;
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  rightValue?: string;
  hasChevron?: boolean;
  danger?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

function MenuItem({
  icon,
  label,
  rightValue,
  hasChevron,
  danger,
  onClick,
  disabled,
}: MenuItemProps) {
  return (
    <button
      className={`flex items-center w-full h-9 px-2 rounded-8 transition-colors touch-manipulation border-0 bg-transparent cursor-pointer hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed ${
        danger ? "text-red" : "text-primary"
      }`}
      style={{ fontSize: 14, fontWeight: 500, lineHeight: "19px" }}
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
    >
      <div className="flex items-center gap-1.5 flex-1">
        <span className="flex items-center justify-center w-5 h-5 flex-shrink-0">{icon}</span>
        <span className="text-left">{label}</span>
      </div>
      {rightValue && (
        <span
          className="flex items-center gap-1 text-secondary"
          style={{ fontSize: 14, fontWeight: 500 }}
        >
          {rightValue}
          {hasChevron && <CaretRightIcon size={13} weight="bold" />}
        </span>
      )}
    </button>
  );
}

export function UserAvatarDropdown({
  address = "",
  profileAddress,
  displayName,
  onDisconnect,
  onOpenSettings,
  isDisconnecting = false,
  guestMode = false,
  renderTrigger,
}: UserAvatarDropdownProps) {
  // DD-113: 认购模式下强制使用 EOA 地址（不显示代理钱包），隐藏昵称并禁止打开 Settings
  const headerAddress = IS_SUBSCRIPTION_MODE ? address : profileAddress || address;
  const effectiveDisplayName = IS_SUBSCRIPTION_MODE ? undefined : displayName;
  const effectiveOnOpenSettings = IS_SUBSCRIPTION_MODE ? undefined : onOpenSettings;
  const locale = useLocale() as Locale;
  const t = useTranslations("userMenu");
  const intlRouter = useRouter();
  const intlPathname = usePathname();
  const [isPendingLocale, startLocaleTransition] = useTransition();

  const currency = useCurrencyStore(selectCurrency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const theme = useThemeStore(selectTheme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [isOpen, setIsOpen] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const [showLangPanel, setShowLangPanel] = useState(false);
  const [showCurrencyPanel, setShowCurrencyPanel] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentLang = LANG_OPTIONS.find((l) => l.code === locale) ?? LANG_OPTIONS[1];

  const handleSelectLang = useCallback(
    (code: Locale) => {
      setShowLangPanel(false);
      startLocaleTransition(() => {
        intlRouter.replace(intlPathname, { locale: code });
      });
    },
    [intlRouter, intlPathname]
  );

  useEffect(() => {
    setIsHoverDevice(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Reset sub-panels when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setShowLangPanel(false);
      setShowCurrencyPanel(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isHoverDevice) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen, isHoverDevice]);

  const handleMouseEnter = useCallback(() => {
    if (!isHoverDevice) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsOpen(true);
  }, [isHoverDevice]);

  const handleMouseLeave = useCallback(() => {
    if (!isHoverDevice) return;
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 300);
  }, [isHoverDevice]);

  const handleClick = useCallback(() => {
    if (isHoverDevice) return;
    setIsOpen((prev) => !prev);
  }, [isHoverDevice]);

  const handleCopyAddress = useCallback(() => {
    void copy(headerAddress);
  }, [copy, headerAddress]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger */}
      {renderTrigger ? (
        renderTrigger({ isOpen, isDisconnecting, onClick: handleClick })
      ) : (
        <button
          className="flex items-center gap-1 flex-shrink-0 cursor-pointer touch-manipulation border-0 bg-transparent p-0"
          onClick={handleClick}
          disabled={isDisconnecting}
          aria-label="User menu"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <div className="flex items-center justify-center w-10 h-10">
            {isDisconnecting ? (
              <CircleNotchIcon size={20} className="text-secondary animate-spin" />
            ) : (
              <AvatarIcon address={address} size={40} />
            )}
          </div>
          <CaretDownIcon size={12} className="text-secondary" />
        </button>
      )}

      {/* Dropdown panel — always rendered, animated via CSS transitions (no flicker) */}
      <div
        className={`absolute top-full right-0 mt-2 z-50 w-[240px] flex flex-col gap-4 py-4 rounded-12 border border-divider-light ${
          isOpen
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 -translate-y-2 scale-[0.96] pointer-events-none"
        }`}
        style={{
          background: "rgba(17, 17, 20, 0.95)",
          backdropFilter: "blur(6.5px)",
          WebkitBackdropFilter: "blur(6.5px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          visibility: isOpen ? "visible" : "hidden",
          transition: isOpen
            ? "opacity 200ms ease-out, transform 200ms ease-out, visibility 0s 0s"
            : "opacity 150ms ease-in, transform 150ms ease-in, visibility 0s 150ms",
        }}
        role="menu"
        aria-hidden={!isOpen}
      >
        {/* Header: Avatar + Name + Address — clickable to open Settings; hidden in guest mode */}
        {!guestMode && (
          <>
            <button
              type="button"
              className="flex items-center justify-between text-left mx-2 px-2 py-1 rounded-8 border-0 bg-transparent cursor-pointer touch-manipulation transition-colors hover:bg-white/[0.06] disabled:cursor-default"
              onClick={() => {
                if (!effectiveOnOpenSettings) return;
                setIsOpen(false);
                effectiveOnOpenSettings();
              }}
              disabled={!effectiveOnOpenSettings}
              role="menuitem"
              aria-label="Open user settings"
            >
              <div className="flex items-center min-w-0" style={{ gap: 12 }}>
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 48, height: 48 }}
                >
                  <AvatarIcon address={address} size={48} />
                </div>
                <div className="flex flex-col min-w-0" style={{ gap: 2 }}>
                  <span
                    className={`text-primary truncate ${effectiveDisplayName ? "font-medium" : "font-bold"}`}
                    style={{ fontSize: 14, lineHeight: "19px" }}
                  >
                    {effectiveDisplayName ||
                      (headerAddress ? `${headerAddress.slice(0, 10)}...` : "")}
                  </span>
                  <div className="flex items-center" style={{ gap: 4 }}>
                    <span
                      className="font-medium truncate text-secondary"
                      style={{ fontSize: 12, lineHeight: "18px" }}
                    >
                      {truncateAddress(headerAddress)}
                    </span>
                    {/* Copy button — span (not button) to avoid nested interactive; click stops propagation */}
                    <span
                      role="button"
                      tabIndex={0}
                      className="flex items-center justify-center cursor-pointer p-0 hover:opacity-80 transition-opacity"
                      style={{ width: 16, height: 16 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyAddress();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCopyAddress();
                        }
                      }}
                      aria-label="Copy address"
                    >
                      {copied ? (
                        <CheckIcon size={14} weight="bold" className="text-green" />
                      ) : (
                        <CopyIcon size={14} weight="bold" className="text-secondary" />
                      )}
                    </span>
                  </div>
                </div>
              </div>
              {effectiveOnOpenSettings && (
                <CaretRightIcon size={16} className="text-secondary flex-shrink-0 ml-2" />
              )}
            </button>

            {/* Divider */}
            <div className="h-px bg-tertiary" />
          </>
        )}

        {/* Menu items / Language sub-panel / Currency sub-panel */}
        {showLangPanel ? (
          <div className="flex flex-col" style={{ padding: "0 16px", gap: 12 }}>
            <button
              className="flex items-center gap-1.5 h-8 px-2 text-secondary hover:text-primary transition-colors border-0 bg-transparent cursor-pointer p-0 touch-manipulation"
              style={{ fontSize: 13, fontWeight: 500 }}
              onClick={() => setShowLangPanel(false)}
            >
              <CaretLeftIcon size={14} weight="bold" />
              <span>Back</span>
            </button>
            {LANG_OPTIONS.map(({ code, label, flag }) => (
              <button
                key={code}
                className={`flex items-center gap-2.5 w-full min-h-[36px] px-1 text-left transition-colors border-0 bg-transparent cursor-pointer touch-manipulation rounded-8 ${
                  code === locale
                    ? "bg-white/10 text-primary font-semibold"
                    : "text-secondary hover:bg-white/[0.06] hover:text-primary"
                }`}
                style={{ fontSize: 14 }}
                onClick={() => handleSelectLang(code)}
                disabled={isPendingLocale}
              >
                <span className="text-base leading-none">{flag}</span>
                <span className="flex-1">{label}</span>
                {code === locale && <CheckIcon size={14} weight="bold" className="text-green" />}
              </button>
            ))}
          </div>
        ) : showCurrencyPanel ? (
          <div className="flex flex-col" style={{ padding: "0 16px", gap: 12 }}>
            <button
              className="flex items-center gap-1.5 h-8 px-2 text-secondary hover:text-primary transition-colors border-0 bg-transparent cursor-pointer p-0 touch-manipulation"
              style={{ fontSize: 13, fontWeight: 500 }}
              onClick={() => setShowCurrencyPanel(false)}
            >
              <CaretLeftIcon size={14} weight="bold" />
              <span>Back</span>
            </button>
            {(["USD", "ODD"] as const).map((code) => (
              <button
                key={code}
                className={`flex items-center gap-2.5 w-full min-h-[36px] px-1 text-left transition-colors border-0 bg-transparent cursor-pointer touch-manipulation rounded-8 ${
                  code === currency
                    ? "bg-white/10 text-primary font-semibold"
                    : "text-secondary hover:bg-white/[0.06] hover:text-primary"
                }`}
                style={{ fontSize: 14 }}
                onClick={() => {
                  setCurrency(code as DisplayCurrency);
                  setShowCurrencyPanel(false);
                }}
              >
                {code === "USD" ? (
                  <CurrencyCircleDollarIcon size={18} className="text-secondary" />
                ) : (
                  <TokenIconWithChain
                    tokenIconUrl={PLATFORM_TOKEN.iconUrl}
                    tokenSymbol={PLATFORM_TOKEN_DISPLAY}
                    size={18}
                    hideChainBadge
                  />
                )}
                <span className="flex-1">{code === "ODD" ? PLATFORM_TOKEN_DISPLAY : code}</span>
                {code === currency && <CheckIcon size={14} weight="bold" className="text-green" />}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col" style={{ padding: "0 16px", gap: 12 }}>
            {false && (
              <MenuItem
                icon={
                  theme === "dark" ? (
                    <SunIcon size={20} weight="regular" className="text-primary" />
                  ) : (
                    <MoonIcon size={20} weight="regular" className="text-primary" />
                  )
                }
                label={t(theme === "dark" ? "themeLight" : "themeDark")}
                onClick={toggleTheme}
              />
            )}
            <MenuItem
              icon={<GlobeCustomIcon size={20} className="text-primary" />}
              label={t("language")}
              rightValue={currentLang.flag}
              hasChevron
              onClick={() => setShowLangPanel(true)}
            />
            <MenuItem
              icon={
                <CurrencyCircleDollarIcon size={20} weight="regular" className="text-primary" />
              }
              label={t("currency")}
              rightValue={currency === "ODD" ? PLATFORM_TOKEN_DISPLAY : currency}
              hasChevron
              onClick={() => setShowCurrencyPanel(true)}
            />
            {/* Portfolio / Accuracy — hidden until feature is ready */}
            {/* {!guestMode && (
              <>
                <MenuItem
                  icon={<ChartPieIcon size={20} weight="regular" className="text-primary" />}
                  label={t("portfolio")}
                  hasChevron
                  disabled
                />
                <MenuItem
                  icon={<CrosshairIcon size={20} weight="regular" className="text-primary" />}
                  label={t("accuracy")}
                  disabled
                />
              </>
            )} */}
            {/* Help Center / Terms of Use — only shown when logged in */}
            {!guestMode && (
              <MenuItem
                icon={<QuestionIcon size={20} weight="regular" className="text-primary" />}
                label={t("helpCenter")}
              />
            )}
            <MenuItem
              icon={<FileTextIcon size={20} weight="regular" className="text-primary" />}
              label={t("documentation")}
              onClick={() =>
                window.open(
                  "https://oddfi.gitbook.io/oddfi-docs-1",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            />
            {!guestMode && (
              <MenuItem
                icon={<ScalesIcon size={20} weight="regular" className="text-primary" />}
                label={t("termsOfUse")}
                disabled
              />
            )}
          </div>
        )}

        {/* Divider + Disconnect — hidden in guest mode */}
        {!guestMode && (
          <>
            <div className="h-px bg-tertiary" />
            <div style={{ padding: "0 16px" }}>
              <button
                className="flex items-center justify-center w-full h-[40px] rounded-8 bg-btn-tertiary text-primary cursor-pointer transition-colors hover:bg-btn-tertiary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontSize: 14, fontWeight: 500, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}
                onClick={onDisconnect}
                disabled={isDisconnecting}
                role="menuitem"
              >
                {isDisconnecting ? (
                  <CircleNotchIcon size={16} className="text-primary animate-spin" />
                ) : (
                  t("disconnect")
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
