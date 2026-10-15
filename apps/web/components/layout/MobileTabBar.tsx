"use client";

import { useTranslations } from "next-intl";
import { GiftIcon } from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/navigation";
import WorldCupTrophyIcon from "@/components/icons/WorldCupTrophyIcon";
import { isNavItemLaunchHidden } from "@/lib/feature-flags";

interface TabItem {
  key: string;
  href: string;
  icon: React.ReactNode;
}

function IconStake() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function IconSwap() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 16V4m0 0L3 8m4-4l4 4" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function IconInvite() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconPortfolio() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  );
}

// DD-144：swap 上线下架，默认隐藏底部 Tab 入口（见 lib/feature-flags isNavItemLaunchHidden）
const TAB_ITEMS: TabItem[] = [
  // 大力神杯导航：底部 Tab 的 market 入口换成奖杯图标，固定金色不随 active 变色
  { key: "markets", href: "/markets", icon: <WorldCupTrophyIcon className="h-[22px] w-auto" /> },
  { key: "portfolio", href: "/portfolio", icon: <IconPortfolio /> },
  { key: "stake", href: "/stake", icon: <IconStake /> },
  { key: "swap", href: "/swap", icon: <IconSwap /> },
  { key: "referral", href: "/referral", icon: <IconInvite /> },
  {
    key: "rewards",
    href: "/rewards",
    icon: <GiftIcon className="h-[22px] w-[22px]" weight="fill" />,
  },
].filter((item) => !isNavItemLaunchHidden(item.key));

export default function MobileTabBar() {
  const pathname = usePathname();
  const t = useTranslations("mobileTab");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden mobile-tab-bar
                 border-t border-white/10"
      style={{
        // @figma-hardcoded: rgba(2,6,23,0.92) tabbar-bg — pending design token
        background: "rgba(2,6,23,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center">
        {TAB_ITEMS.map(({ key, href, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-[3px]
                          min-h-[56px] text-xs font-medium transition-colors duration-150
                          no-select touch-manipulation
                          ${isActive ? "text-green" : "text-secondary"}`}
            >
              {icon}
              <span>
                {t(key as "markets" | "portfolio" | "stake" | "swap" | "referral" | "rewards")}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
