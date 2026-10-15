"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import MobileBottomSheet from "@/components/ui/MobileBottomSheet";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useWallet } from "@/hooks/useWallet";
import { useProxyWallet } from "@/hooks/useProxyWallet";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAccount } from "wagmi";
import { useAuthStore } from "@/stores/authStore";
import { useWalletSheetStore } from "@/stores/walletSheetStore";
import { useCurrencyStore, selectCurrency } from "@/stores/currencyStore";
import type { DisplayCurrency } from "@/stores/currencyStore";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import AvatarIcon from "@/components/icons/AvatarIcon";
import {
  XIcon,
  CurrencyCircleDollarIcon,
  QuestionIcon,
  FileTextIcon,
  ScalesIcon,
  CaretRightIcon,
  CheckIcon,
  CopyIcon,
  CircleNotchIcon,
  SunIcon,
  MoonIcon,
  HouseIcon,
  LockKeyIcon,
  HandCoinsIcon,
  ArrowsClockwiseIcon,
  UserPlusIcon,
  BriefcaseIcon,
  RocketLaunchIcon,
  GiftIcon,
} from "@phosphor-icons/react";
import { IS_PRESALE_ENABLED } from "@/lib/presale/presale-visibility";
import { isNavItemLaunchHidden } from "@/lib/feature-flags";
import GlobeCustomIcon from "@/components/icons/GlobeCustomIcon";
import NavMarketsIcon from "@/components/icons/NavMarketsIcon";
import NavLiquidityIcon from "@/components/icons/NavLiquidityIcon";
import NavAiAgentIcon from "@/components/icons/NavAiAgentIcon";
import WorldCupTrophyIcon from "@/components/icons/WorldCupTrophyIcon";
import { useThemeStore, selectTheme } from "@/stores/themeStore";

// ─── Data ─────────────────────────────────────────────────────────────────────

const LANG_OPTIONS: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "zh", label: "简体中文", flag: "🇨🇳" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

const CURRENCY_OPTIONS = [
  { code: "USD", label: "USD", type: "flag" as const, flag: "🇺🇸" },
  { code: "ODD", label: PLATFORM_TOKEN_DISPLAY, type: "coin" as const },
];

type NavIconComponent = React.ComponentType<{ size?: number; className?: string }>;

type NavItem =
  | { key: string; href: string; Icon: NavIconComponent; special?: false }
  | { key: string; href: string; Icon?: undefined; special: true };

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { key: "home", href: "/home", Icon: HouseIcon },
  { key: "markets", href: "/markets", Icon: NavMarketsIcon },
  { key: "pools", href: "/liquidity", Icon: NavLiquidityIcon },
  { key: "stake", href: "/stake", Icon: LockKeyIcon },
  { key: "lend", href: "/lend", Icon: HandCoinsIcon },
  { key: "swap", href: "/swap", Icon: ArrowsClockwiseIcon },
  { key: "referral", href: "/referral", Icon: UserPlusIcon },
  { key: "rewards", href: "/rewards", Icon: GiftIcon },
  { key: "portfolio", href: "/portfolio", Icon: BriefcaseIcon },
  { key: "oddPresale", href: "/odd-presale", Icon: RocketLaunchIcon },
  { key: "aiAgent", href: "/ai-agent", special: true },
];

type SubSheet = "language" | "currency" | null;

// ─── SettingsBottomSheet ──────────────────────────────────────────────────────
// Thin wrapper over MobileBottomSheet for Language / Currency selection
// (Figma 1039:141359 / 1039:141451)

interface SettingsBottomSheetProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function SettingsBottomSheet({ title, open, onClose, children }: SettingsBottomSheetProps) {
  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      zIndex={70}
      title={title}
      showCloseButton
      backdropStyle={{
        backdropFilter: "blur(1px)",
        WebkitBackdropFilter: "blur(1px)",
      }}
      backdropClassName="bg-fill-mask"
    >
      {/* Content — scrollable if many items */}
      <div
        data-scroll-content
        className="flex flex-col gap-[16px] mt-[24px] px-[16px] pb-[24px] overflow-y-auto max-h-[60vh] overscroll-contain"
      >
        {children}
      </div>
    </MobileBottomSheet>
  );
}

// ─── LanguageSheet ────────────────────────────────────────────────────────────

interface LanguageSheetProps {
  currentLocale: Locale;
  onSelect: (code: Locale) => void;
  onClose: () => void;
  isPending: boolean;
  title: string;
}

function LanguageSheet({ currentLocale, onSelect, onClose, isPending, title }: LanguageSheetProps) {
  return (
    <SettingsBottomSheet title={title} open onClose={onClose}>
      {LANG_OPTIONS.map(({ code, label, flag }) => {
        const isSelected = code === currentLocale;
        return (
          <button
            key={code}
            className="flex items-center justify-between w-full h-[40px] border-0 bg-transparent p-0 cursor-pointer touch-manipulation"
            onClick={() => onSelect(code)}
            disabled={isPending}
          >
            <div className="flex items-center gap-[12px]">
              {/* Flag — 24x24 circle */}
              <span className="flex items-center justify-center w-[24px] h-[24px] text-[18px] leading-none">
                {flag}
              </span>
              <span
                className={`text-[14px] font-medium leading-[19px] ${isSelected ? "text-brand-default" : "text-primary"}`}
              >
                {label}
              </span>
            </div>
            {isSelected && <CheckIcon size={24} weight="bold" className="text-brand-default" />}
          </button>
        );
      })}
    </SettingsBottomSheet>
  );
}

// ─── CurrencySheet ────────────────────────────────────────────────────────────

interface CurrencySheetProps {
  currentCurrency: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  title: string;
}

function CurrencySheet({ currentCurrency, onSelect, onClose, title }: CurrencySheetProps) {
  return (
    <SettingsBottomSheet title={title} open onClose={onClose}>
      {CURRENCY_OPTIONS.map(({ code, label, type }) => {
        const isSelected = code === currentCurrency;
        return (
          <button
            key={code}
            className="flex items-center justify-between w-full h-[40px] border-0 bg-transparent p-0 cursor-pointer touch-manipulation"
            onClick={() => onSelect(code)}
          >
            <div className="flex items-center gap-[12px]">
              {/* Icon — 24x24 */}
              {type === "flag" ? (
                <CurrencyCircleDollarIcon size={24} className="text-secondary" />
              ) : (
                <TokenIconWithChain
                  tokenIconUrl={PLATFORM_TOKEN.iconUrl}
                  tokenSymbol={PLATFORM_TOKEN_DISPLAY}
                  size={24}
                  hideChainBadge
                />
              )}
              <span
                className={`text-[14px] font-medium leading-[19px] ${isSelected ? "text-brand-default" : "text-primary"}`}
              >
                {label}
              </span>
            </div>
            {isSelected && <CheckIcon size={24} weight="bold" className="text-brand-default" />}
          </button>
        );
      })}
    </SettingsBottomSheet>
  );
}

// ─── MobileMenuSheet ──────────────────────────────────────────────────────────
// Full-screen H5 menu overlay (Figma 1034:137557 / 1039:141013)

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
  /** 点击头部身份区（头像+名字+地址）时触发，未传时该区域不可点 */
  onOpenSettings?: () => void;
}

export default function MobileMenuSheet({ open, onClose, onOpenSettings }: MobileMenuSheetProps) {
  const locale = useLocale() as Locale;
  const intlRouter = useRouter();
  const intlPathname = usePathname();
  const t = useTranslations("nav");
  const tUser = useTranslations("userMenu");
  const [isPendingLocale, startLocaleTransition] = useTransition();

  const { address, isConnected, disconnect, isDisconnecting } = useWallet();
  const { address: fullAddress } = useAccount();
  const { wallet: proxyWallet } = useProxyWallet();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const displayAddress = fullAddress ?? address ?? "";
  const profileAddress = proxyWallet?.address ?? displayAddress;
  const isLoggedIn = isAuthenticated || (isConnected && !!displayAddress);
  const { profile } = useUserProfile(isLoggedIn ? profileAddress : undefined);

  const triggerConnect = useWalletSheetStore((s) => s.triggerConnect);

  const [subSheet, setSubSheet] = useState<SubSheet>(null);
  const [copied, setCopied] = useState(false);
  const selectedCurrency = useCurrencyStore(selectCurrency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const theme = useThemeStore(selectTheme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const tUserMenu = useTranslations("userMenu");

  const currentLang = LANG_OPTIONS.find((l) => l.code === locale) ?? LANG_OPTIONS[0];

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (subSheet) setSubSheet(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, subSheet, onClose]);

  // Reset sub-sheet on close
  useEffect(() => {
    if (!open) {
      setSubSheet(null);
      setCopied(false);
    }
  }, [open]);

  // Close menu on route change (safer than onClick close which can unmount before navigation)
  const pathname = usePathname();
  const initialPathRef = useRef(pathname);
  useEffect(() => {
    if (open && pathname !== initialPathRef.current) {
      onClose();
    }
  }, [pathname, open, onClose]);
  // Reset initial path when menu opens
  useEffect(() => {
    if (open) initialPathRef.current = pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelectLang = useCallback(
    (code: Locale) => {
      setSubSheet(null);
      // 切换语言本质是一次导航，但 next-intl 的 usePathname 去掉了 locale 段，
      // 「路由变化自动关菜单」的 effect 检测不到 locale 变化 → 菜单残留为打开态，
      // 而页面其余部分已按新语言重渲染，造成右上角按钮与菜单状态错位。
      // 这里显式关闭整个菜单，确保状态确定性（切语言即关菜单，符合常见 UX）。
      onClose();
      startLocaleTransition(() => {
        intlRouter.replace(intlPathname, { locale: code });
      });
    },
    [intlRouter, intlPathname, onClose]
  );

  const handleSelectCurrency = useCallback(
    (code: string) => {
      setCurrency(code as DisplayCurrency);
      setSubSheet(null);
    },
    [setCurrency]
  );

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(profileAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [profileAddress]);

  const handleConnect = useCallback(() => {
    onClose();
    triggerConnect();
  }, [onClose, triggerConnect]);

  const handleDisconnect = useCallback(() => {
    disconnect?.();
    onClose();
  }, [disconnect, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden bg-primary flex flex-col">
      {/* ── Header (64px) — Figma: bg-primary border-b border-divider-light px-16 ── */}
      <div className="flex items-center justify-between h-[64px] min-h-[64px] px-[16px] border-b border-divider-light bg-primary">
        {isLoggedIn ? (
          /* Logged in header: Avatar + Name + Address (Figma 1039:141013) — clickable to open Settings */
          <button
            type="button"
            className="flex items-center gap-[12px] flex-1 min-w-0 border-0 bg-transparent p-0 text-left cursor-pointer touch-manipulation"
            onClick={onOpenSettings}
            disabled={!onOpenSettings}
            aria-label="Open user settings"
          >
            <AvatarIcon address={displayAddress} size={40} />
            <div className="flex flex-col gap-[2px] min-w-0">
              <span className="text-[14px] font-medium text-primary leading-[19px] truncate">
                {profile?.username || "User"}
              </span>
              <div className="flex items-center gap-[4px]">
                <span className="text-[12px] font-medium text-secondary leading-[18px]">
                  {profileAddress.slice(0, 5)}...{profileAddress.slice(-5)}
                </span>
                {/* Copy: span (not button) to avoid nested interactive */}
                <span
                  role="button"
                  tabIndex={0}
                  className="flex items-center justify-center w-[16px] h-[16px] cursor-pointer touch-manipulation"
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
                    <CheckIcon size={12} weight="bold" className="text-green" />
                  ) : (
                    <CopyIcon size={12} weight="bold" className="text-secondary" />
                  )}
                </span>
              </div>
            </div>
          </button>
        ) : (
          /* Unlogged header: Logo (Figma 1034:137557) */
          <Link href="/markets" className="shrink-0 flex items-center gap-[5px]">
            <Image src="/images/logo-icon.svg" alt="" width={20} height={15} sizes="20px" />
            <span className="font-orbitron font-bold text-white text-[19px] leading-none">
              oddfi
            </span>
          </Link>
        )}

        {/* Close button — Figma: bg-tertiary rounded-8 32x32 */}
        <button
          className="flex items-center justify-center w-[32px] h-[32px] rounded-8 bg-tertiary border-0 cursor-pointer shrink-0 touch-manipulation"
          onClick={onClose}
          aria-label="Close menu"
        >
          <XIcon size={20} weight="bold" className="text-white" />
        </button>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-[16px] pt-[16px]">
          {/* Nav Links — Figma 6959:123894: 14px Medium + 20px icon + gap-12，行高 32 容器，gap-16 行间距 */}
          <nav className="flex flex-col gap-[16px]">
            {NAV_ITEMS.filter((item) => item.key !== "portfolio" || isAuthenticated)
              // DD-119 §3.5 第2层：testnet 隐藏认购入口（oddPresale）；referral 站点级保留
              // DD-146：旧 /invest 入口下线（路由 308 重定向到 /odd-presale）
              .filter((item) => IS_PRESALE_ENABLED || item.key !== "oddPresale")
              // DD-144：lend/swap 上线下架，默认隐藏
              .filter((item) => !isNavItemLaunchHidden(item.key))
              .map((item) => {
                const { key, href } = item;
                const isActive = intlPathname === href || intlPathname.startsWith(href + "/");
                if (item.special) {
                  // AI Agent: 自定义 sparkles + 斜体渐变文字（mint→yellow）
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-[10px] min-h-[44px] no-underline touch-manipulation"
                    >
                      <NavAiAgentIcon className="shrink-0" />
                      <span
                        className="text-[14px] font-medium italic leading-[20px] bg-clip-text text-transparent"
                        style={{
                          backgroundImage: "linear-gradient(135deg, #4AE7DD 0%, #EAEA32 100%)",
                        }}
                      >
                        {t(key)}
                      </span>
                    </Link>
                  );
                }
                const Icon = item.Icon;
                return (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-[12px] min-h-[44px] no-underline touch-manipulation"
                  >
                    {key === "markets" ? (
                      // 大力神杯导航：market 入口换成奖杯图标（Figma 7729:112656），固定金色不随 active 变色
                      <WorldCupTrophyIcon className="h-[26px] w-auto shrink-0" />
                    ) : (
                      <Icon
                        size={20}
                        className={`shrink-0 ${isActive ? "text-brand-default" : "text-primary"}`}
                      />
                    )}
                    <span
                      className={`text-[14px] font-medium leading-[18px] ${isActive ? "text-brand-default" : "text-primary"}`}
                    >
                      {t(key)}
                    </span>
                  </Link>
                );
              })}
          </nav>

          {/* Divider — Figma: gap-32 above and below */}
          <div className="h-px bg-tertiary my-[32px]" />

          {/* Settings Menu — Figma: flex-col gap-12 */}
          <div className="flex flex-col gap-[12px]">
            {/* Theme toggle — dark→Sun (点击切浅色) / light→Moon */}
            {false && (
              <button
                className="flex items-center w-full min-h-[44px] gap-[8px] border-0 bg-transparent p-0 cursor-pointer touch-manipulation"
                onClick={toggleTheme}
              >
                {theme === "dark" ? (
                  <SunIcon size={20} weight="regular" className="text-primary" />
                ) : (
                  <MoonIcon size={20} weight="regular" className="text-primary" />
                )}
                <span className="text-[14px] font-medium text-primary leading-[19px]">
                  {tUserMenu(theme === "dark" ? "themeLight" : "themeDark")}
                </span>
              </button>
            )}

            {/* Language — has right value + chevron */}
            <button
              className="flex items-center justify-between w-full min-h-[44px] border-0 bg-transparent p-0 cursor-pointer touch-manipulation"
              onClick={() => setSubSheet("language")}
            >
              <div className="flex items-center gap-[8px]">
                <GlobeCustomIcon size={20} className="text-primary" />
                <span className="text-[14px] font-medium text-primary leading-[19px]">
                  {tUser("language")}
                </span>
              </div>
              <div className="flex items-center gap-[4px]">
                <span className="text-[14px] font-medium text-secondary leading-[19px]">
                  {currentLang.label}
                </span>
                <CaretRightIcon size={13} weight="bold" className="text-secondary" />
              </div>
            </button>

            {/* Currency — has right value + chevron */}
            <button
              className="flex items-center justify-between w-full min-h-[44px] border-0 bg-transparent p-0 cursor-pointer touch-manipulation"
              onClick={() => setSubSheet("currency")}
            >
              <div className="flex items-center gap-[8px]">
                <CurrencyCircleDollarIcon size={20} weight="regular" className="text-primary" />
                <span className="text-[14px] font-medium text-primary leading-[19px]">
                  {tUser("currency")}
                </span>
              </div>
              <div className="flex items-center gap-[4px]">
                <span className="text-[14px] font-medium text-secondary leading-[19px]">
                  {selectedCurrency}
                </span>
                <CaretRightIcon size={13} weight="bold" className="text-secondary" />
              </div>
            </button>

            {/* Accuracy — hidden until feature is ready */}
            {/* <button className="flex items-center w-full min-h-[44px] gap-[8px] border-0 bg-transparent p-0 cursor-pointer touch-manipulation">
              <CrosshairIcon size={20} weight="regular" className="text-primary" />
              <span className="text-[14px] font-medium text-primary leading-[19px]">
                {tUser("accuracy")}
              </span>
            </button> */}

            {/* Help Center — only shown when logged in */}
            {isLoggedIn && (
              <button className="flex items-center w-full min-h-[44px] gap-[8px] border-0 bg-transparent p-0 cursor-pointer touch-manipulation">
                <QuestionIcon size={20} weight="regular" className="text-primary" />
                <span className="text-[14px] font-medium text-primary leading-[19px]">
                  {tUser("helpCenter")}
                </span>
              </button>
            )}

            {/* Documentation */}
            <a
              href="https://oddfi.gitbook.io/oddfi-docs-1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center w-full min-h-[44px] gap-[8px] border-0 bg-transparent p-0 cursor-pointer touch-manipulation no-underline"
            >
              <FileTextIcon size={20} weight="regular" className="text-primary" />
              <span className="text-[14px] font-medium text-primary leading-[19px]">
                {tUser("documentation")}
              </span>
            </a>

            {/* Terms of Use — only shown when logged in */}
            {isLoggedIn && (
              <button className="flex items-center w-full min-h-[44px] gap-[8px] border-0 bg-transparent p-0 cursor-pointer touch-manipulation">
                <ScalesIcon size={20} weight="regular" className="text-primary" />
                <span className="text-[14px] font-medium text-primary leading-[19px]">
                  {tUser("termsOfUse")}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Button — Figma: h-48 mx-16 mb-24 rounded-12 ── */}
      <div className="px-[16px] pb-[max(24px,env(safe-area-inset-bottom))] shrink-0">
        {isLoggedIn ? (
          <button
            className="flex items-center justify-center w-full h-[48px] rounded-12 bg-secondary border-0 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.1)] touch-manipulation"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? (
              <CircleNotchIcon size={20} className="text-white animate-spin" />
            ) : (
              <span className="text-[14px] font-medium text-white leading-[19px]">
                Disconnect Wallet
              </span>
            )}
          </button>
        ) : (
          <button
            data-earlybird-gate
            className="flex items-center justify-center w-full h-[48px] rounded-12 bg-btn-primary border-0 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.1)] touch-manipulation"
            onClick={handleConnect}
          >
            <span className="text-[14px] font-medium text-static-black leading-[19px]">
              Connect Wallet
            </span>
          </button>
        )}
      </div>

      {/* ── Sub-sheets: Language / Currency ── */}
      {subSheet === "language" && (
        <LanguageSheet
          currentLocale={locale}
          onSelect={handleSelectLang}
          onClose={() => setSubSheet(null)}
          isPending={isPendingLocale}
          title={tUser("language")}
        />
      )}
      {subSheet === "currency" && (
        <CurrencySheet
          currentCurrency={selectedCurrency}
          onSelect={handleSelectCurrency}
          onClose={() => setSubSheet(null)}
          title={tUser("currency")}
        />
      )}
    </div>,
    document.body
  );
}
