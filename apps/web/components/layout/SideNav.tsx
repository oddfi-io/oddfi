"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

interface Category {
  key: string;
  icon: string;
}

const CATEGORIES: Category[] = [
  { key: "favorites", icon: "★" },
  { key: "football", icon: "⚽" },
  { key: "basketball", icon: "🏀" },
  { key: "ufc", icon: "🥊" },
  { key: "esports", icon: "🎮" },
  { key: "politics", icon: "🏛" },
  { key: "tech", icon: "💻" },
];

export default function SideNav() {
  const [collapsed, setCollapsed] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeCategory = searchParams.get("category") ?? "";
  const t = useTranslations("sidebar");

  // Figma 6364:90683 · 2026-05-18 改版：
  //   去掉旧版块状底色 + 重描边 + 阴影 + active 指示条，改为「右侧单条 vertical divider + 纯文字行」线分割
  //   item 仅做 p-[8px] rounded + 纯文字 + 仅 text 颜色变化（无 bg / 无 border / 无 indicator）
  return (
    <aside
      className={`shrink-0 flex flex-col border-r border-divider transition-all duration-200 bg-primary
                  ${collapsed ? "w-16" : "w-[170px]"}`}
    >
      {/* Collapse toggle */}
      <div className="flex justify-end px-3 pt-4 pb-3">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-secondary hover:text-primary text-lg leading-none transition-colors
                     min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={collapsed ? t("expand") : t("collapse")}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Category list — 线分割：item 无块底/无 border/无 active 块，仅 text 颜色变化 */}
      <nav className="flex flex-col gap-[2px] px-2 pb-4">
        {CATEGORIES.map(({ key, icon }) => {
          const isActive = activeCategory === key;
          const href = `${pathname}?category=${key}`;

          return (
            <Link
              key={key}
              href={href}
              className={`flex items-center gap-[8px] rounded-12 p-[8px] text-[16px] leading-[24px]
                          transition-colors duration-150 min-h-[44px] no-select
                          ${collapsed ? "justify-center" : ""}
                          ${
                            isActive
                              ? "text-brand-default font-semibold"
                              : "text-primary font-medium hover:text-brand-default"
                          }`}
            >
              <span className="text-base leading-none shrink-0">{icon}</span>
              {!collapsed && (
                <span className="truncate">
                  {t(
                    key as
                      | "favorites"
                      | "football"
                      | "basketball"
                      | "ufc"
                      | "esports"
                      | "politics"
                      | "tech"
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
