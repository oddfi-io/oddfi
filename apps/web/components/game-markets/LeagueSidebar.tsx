"use client";

import { memo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { SoccerBallIcon, ArrowLineRightIcon, SidebarSimpleIcon } from "@phosphor-icons/react";
import { useMarketsLayoutStore, selectSelectedTournament } from "@/stores/marketsLayoutStore";
import { useBetSlipStore } from "@/stores/betSlipStore";
import {
  TOURNAMENT_CONFIGS,
  VISIBLE_TOURNAMENT_CONFIGS,
} from "@/config/featured/tournament-stages";
import SportIcon from "@/components/ui/SportIcon";

// ─── Section Header ────────────────────────────────────────────────────────

function SectionHeader({
  title,
  iconSrc,
  onToggle,
  collapsed,
  active = false,
}: {
  title: string;
  iconSrc: string;
  onToggle: () => void;
  collapsed: boolean;
  active?: boolean;
}) {
  // 线分割改版（2026-05-18 Figma 6364:90682）：
  // 去掉 active/hover 块状底，纯文字态：active 走 text-brand-default，hover 走 text-brand-default
  // 折叠态保留图标方形包裹的微 bg 仅用于点中态视觉反馈
  const iconImg = (
    <Image
      src={iconSrc}
      alt={title}
      width={24}
      height={24}
      sizes="24px"
      className="shrink-0 object-contain"
    />
  );
  const titleColor = active ? "text-brand-default" : "text-primary";
  return (
    <button
      className={`flex items-center ${collapsed ? "justify-center p-[4px]" : "gap-[8px] p-[8px]"} rounded-12 w-full min-h-[44px] transition-colors group`}
      onClick={onToggle}
    >
      {collapsed ? (
        <div
          className={`shrink-0 flex items-center justify-center size-[36px] rounded-8 transition-colors ${
            active ? "bg-white/[0.06]" : ""
          }`}
        >
          {iconImg}
        </div>
      ) : (
        iconImg
      )}
      {!collapsed && (
        <span
          className={`text-[16px] font-bold leading-[24px] whitespace-nowrap transition-colors ${titleColor} group-hover:text-brand-default`}
        >
          {title}
        </span>
      )}
    </button>
  );
}

// ─── Tournament Item ──────��───────────────────────────────────────────────

function TournamentItem({
  label,
  imagePath,
  isSelected,
  collapsed,
  onSelect,
}: {
  label: string;
  imagePath: string;
  isSelected: boolean;
  collapsed: boolean;
  onSelect: () => void;
}) {
  // 线分割改版（2026-05-18）：去 active/hover 块状底，纯文字色态
  const iconNode = imagePath ? (
    <SportIcon src={imagePath} size={24} withBg />
  ) : (
    <SoccerBallIcon size={24} weight="fill" className="text-primary" />
  );
  const labelColor = isSelected ? "text-brand-default" : "text-primary";
  return (
    <button
      className={`flex items-center ${collapsed ? "justify-center p-[4px]" : "gap-[10px] px-[16px] py-[8px]"} rounded-12 w-full min-h-[44px] transition-colors group`}
      onClick={onSelect}
      title={collapsed ? label : undefined}
    >
      {collapsed ? (
        <div
          className={`shrink-0 flex items-center justify-center size-[36px] rounded-8 transition-colors ${
            isSelected ? "bg-white/[0.06]" : ""
          }`}
        >
          {iconNode}
        </div>
      ) : (
        <div className="shrink-0 size-[24px]">{iconNode}</div>
      )}
      {!collapsed && (
        <div className="flex items-center justify-between flex-1 min-w-0">
          <span
            className={`text-[14px] font-semibold leading-[19px] whitespace-nowrap truncate transition-colors ${labelColor} group-hover:text-brand-default`}
          >
            {label}
          </span>
          {/* arrows hidden per UI walkthrough */}
        </div>
      )}
    </button>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

interface LeagueSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default memo(function LeagueSidebar({ collapsed = false, onToggle }: LeagueSidebarProps) {
  const [soccerExpanded, setSoccerExpanded] = useState(true);
  const t = useTranslations("markets");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const isCalendarRoute = pathname?.includes("/markets/calendar") ?? false;
  const isBracketRoute = pathname?.includes("/markets/bracket") ?? false;
  const isFixtureRoute = pathname?.includes("/markets/fixture/") ?? false;

  const selectedTournament = useMarketsLayoutStore(selectSelectedTournament);
  const setSelectedTournament = useMarketsLayoutStore((s) => s.setSelectedTournament);
  const storeToggleSidebar = useMarketsLayoutStore((s) => s.toggleSidebar);
  const toggleSidebar = onToggle ?? storeToggleSidebar;

  const setBetSlipOpen = useBetSlipStore((s) => s.setOpen);
  const setBetSlipTab = useBetSlipStore((s) => s.setActiveTab);
  const handleOpenMyBets = () => {
    setBetSlipTab("mybets");
    setBetSlipOpen(true);
  };

  const handleSelectTournament = (key: (typeof TOURNAMENT_CONFIGS)[number]["key"]) => {
    setSelectedTournament(key);
    // 非 markets 主页（calendar / bracket / fixture 详情页）下点击联赛 → push 回主页，
    // 让 selectedTournament store 变更生效；停留在子路由会切了 store 但 URL 不动，体感"点了没反应"。
    if (isCalendarRoute || isBracketRoute || isFixtureRoute) {
      router.push(`/${locale}/markets`);
    }
  };

  // 2026-05-18 Figma 6364:90682：去掉 5px tertiary 包裹边框 + rounded-16 浮动块，
  // 改为右侧 1px divider 线分割；用 h-full 填满父级 grid cell 让 divider 紧贴 topnav 下沿 + 占满到底
  return (
    <aside
      className={`h-full flex flex-col gap-[16px] ${collapsed ? "items-center" : "items-end"} px-[8px] py-[24px] overflow-y-auto overflow-x-hidden scrollbar-thin border-r border-divider`}
    >
      {/* Header: Market title + collapse/expand button */}
      <div
        className={`flex items-center w-full min-h-[24px] ${collapsed ? "justify-center px-[8px]" : "justify-between pl-[8px]"}`}
      >
        {!collapsed && (
          <span className="font-['Orbitron',sans-serif] font-semibold text-[16px] text-primary leading-[24px] whitespace-nowrap">
            {t("sidebarTitle")}
          </span>
        )}
        <button
          className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[28px] hover:opacity-70 transition-opacity"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ArrowLineRightIcon size={20} className="text-secondary" />
          ) : (
            <SidebarSimpleIcon size={20} className="text-secondary" />
          )}
        </button>
      </div>

      {/* My Bets section — Figma 6562:90003，点击打开 BetSlip 并定位 My Bets tab */}
      <SectionHeader
        title={t("myBets")}
        iconSrc="/images/sidebar/news.png"
        onToggle={handleOpenMyBets}
        collapsed={collapsed}
      />

      {/* Soccer section */}
      <div className="flex flex-col gap-[8px] items-start w-full">
        <SectionHeader
          title={t("soccer")}
          iconSrc="/images/sidebar/soccer.png"
          onToggle={() => setSoccerExpanded((v) => !v)}
          collapsed={collapsed}
        />

        {soccerExpanded &&
          VISIBLE_TOURNAMENT_CONFIGS.map((tc) => {
            const isSelected =
              !isCalendarRoute &&
              !isBracketRoute &&
              !isFixtureRoute &&
              selectedTournament === tc.key;
            const label = t.has(tc.labelKey) ? t(tc.labelKey) : tc.labelKey;

            return (
              <TournamentItem
                key={tc.key}
                label={label}
                imagePath={tc.imagePath}
                isSelected={isSelected}
                collapsed={collapsed}
                onSelect={() => handleSelectTournament(tc.key)}
              />
            );
          })}
      </div>

      {/* News section 暂不上线 → 隐藏；后续上新闻接口时恢复 */}

      {/* Calendar section — DD-091 入口 */}
      <Link
        href={`/${locale}/markets/calendar`}
        className="block w-full"
        aria-label={t("calendar")}
      >
        <SectionHeader
          title={t("calendar")}
          iconSrc="/images/sidebar/calendar.png"
          onToggle={() => {}}
          collapsed={collapsed}
          active={isCalendarRoute}
        />
      </Link>

      {/* Bracket section — DD-095 入口 */}
      <Link href={`/${locale}/markets/bracket`} className="block w-full" aria-label={t("bracket")}>
        <SectionHeader
          title={t("bracket")}
          iconSrc="/images/sidebar/bracket.png"
          onToggle={() => {}}
          collapsed={collapsed}
          active={isBracketRoute}
        />
      </Link>
    </aside>
  );
});
