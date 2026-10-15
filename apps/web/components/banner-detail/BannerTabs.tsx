"use client";

import { useEffect, useRef, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { useMarketBanners } from "@/hooks/useMarketBanners";
import type { TemplateId } from "@/types/home-banner";
import {
  FireBannerIcon,
  FootballBannerIcon,
  GoldenBootIcon,
  GoldenGloveIcon,
  MvpIcon,
} from "@/components/icons/BannerTabIcons";

interface TabDef {
  code: TemplateId;
  /** 文案兜底 — list 接口未返回 tag_text 时使用（仅 mock/异常路径） */
  fallbackLabel: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  /** 未激活时图标颜色 class（按 Figma 各 tab 的语义色） */
  inactiveIconClass: string;
}

// 文案来源：useMarketBanners list 接口的 banner.tag_text（按 lang 后端翻译）
// 此处 fallbackLabel 仅作 list 数据缺失时兜底；正常路径走 banner.tag_text
const TABS: readonly TabDef[] = [
  {
    code: "top_wins_the_world_cup",
    fallbackLabel: "HOT MARKET",
    Icon: FireBannerIcon,
    inactiveIconClass: "text-red",
  },
  {
    code: "total_goals",
    fallbackLabel: "PLAYER SPECIAL",
    Icon: FootballBannerIcon,
    inactiveIconClass: "text-fn-orange",
  },
  {
    code: "top_golden_ball_name",
    fallbackLabel: "GOLDEN BALL",
    Icon: MvpIcon,
    inactiveIconClass: "text-brand-default",
  },
  {
    code: "top_golden_boot_name",
    fallbackLabel: "GOLDEN BOOT",
    Icon: GoldenBootIcon,
    inactiveIconClass: "text-yellow-brand-400",
  },
  {
    code: "top_golden_glove_name",
    fallbackLabel: "GOLDEN GLOVE",
    Icon: GoldenGloveIcon,
    inactiveIconClass: "text-fn-yellow",
  },
] as const;

interface Props {
  current: TemplateId;
}

/**
 * BannerTabs：详情页 5 项 tab（DD-085 §3.5 决策 #11，2026-04-27 验收反馈调整为互跳）
 *
 * Figma 节点：[3550:73374](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3550-73374)
 * 行为：高亮当前 banner，点击其他 tab → router.push 切到对应 banner 详情页
 * 视觉：h-10 pill，gap-3，font 12/18 medium
 * 图标：自定义 SVG（公共资源 public/banner/icons/*.svg + 组件 components/icons/BannerTabIcons.tsx），
 *      激活态 text-brand-default；未激活默认 text-primary，fire 例外为 text-red
 */
export default function BannerTabs({ current }: Props) {
  const router = useRouter();
  const { data: banners } = useMarketBanners();
  // 复用同源 cache（与 BannerDetailView 同 queryKey），切换 locale 自动重拉
  const labelByCode = new Map(banners?.map((b) => [b.template_id, b.tag_text]));

  // H5 横向滚动场景：进入页面 / 切换 current 后，把 active chip 滚入视野
  // (PC 走 md:overflow-visible 不需要滚动，但 inline-end 行为对 PC 也无副作用)
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = activeRef.current;
    const nav = navRef.current;
    if (!el || !nav) return;
    // 仅当容器实际可横滚时才滚（避免 PC 无 overflow 触发整页跳动）
    if (nav.scrollWidth <= nav.clientWidth) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [current]);

  return (
    <nav
      ref={navRef}
      className="flex gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] md:overflow-visible"
      aria-label="Banner navigation"
      data-figma-node="3550:73374"
    >
      {TABS.map(({ code, fallbackLabel, Icon, inactiveIconClass }) => {
        const active = code === current;
        const iconClass = active ? "text-brand-default" : inactiveIconClass;
        const label = labelByCode.get(code) || fallbackLabel;
        return (
          <button
            key={code}
            ref={active ? activeRef : undefined}
            type="button"
            onClick={() => {
              if (!active) router.push(`/markets/banner/${code}`);
            }}
            aria-current={active ? "page" : undefined}
            className={[
              "inline-flex h-10 items-center justify-center gap-1 rounded-[100px] border px-3",
              "text-[12px] font-medium leading-[18px] transition-colors",
              active
                ? // @figma-hardcoded: rgba(40,244,210,0.15) tab-active-bg — pending design token (fill/tag/brand-transparent)
                  "border-brand-default bg-[rgba(40,244,210,0.15)] text-brand-default cursor-default"
                : // @figma-hardcoded: #212124 tab-idle-border — pending design token (line/border-secondary)
                  "border-[#212124] bg-secondary text-primary cursor-pointer hover:border-brand-default",
            ].join(" ")}
          >
            <Icon size={18} className={iconClass} />
            <span className="whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
