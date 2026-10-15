"use client";

import { useTranslations } from "next-intl";
import { useRef, useEffect, useCallback, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { DevToolsModal } from "@/components/dev/DevToolsModal";
import { IS_TESTNET } from "@/lib/network-mode";
import { IS_PRESALE_ENABLED } from "@/lib/presale/presale-visibility";
import { isNavItemLaunchHidden } from "@/lib/feature-flags";
import { IS_EARLY_BIRD_MODE } from "@/lib/early-bird-mode";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/stores/authStore";
import { useWalletSheetStore } from "@/stores/walletSheetStore";
import WorldCupTrophyIcon from "@/components/icons/WorldCupTrophyIcon";

/*
 * 关于 LiquidGlass 在此场景失效的根因分析：
 * - GlassFloatCard 用 LiquidGlass 工作良好，因为它在普通流的 section 内，没有 fixed 祖先
 * - TopNav 的祖先链是 `<header position:fixed>` + `<main overflow-x-clip>` 兄弟节点
 * - LiquidGlass 内部依赖 `<span class="glass__warp">` 上的 `backdrop-filter + filter:url(#svg)`
 *   在 Chrome 里，fixed 父级 + 兄弟有 overflow:clip 的页面布局会让"背景画布"采样源失败
 *   表现：filter 边缘高光(aberration)依然渲染，但中央折射区为透明 → 看上去就是普通透明顶栏
 *
 * 用 Tailwind 原生 backdrop-blur 替代 —— 在 fixed 顶栏场景下经过验证可靠（业界绝大多数玻璃顶栏方案）
 * 视觉上失去 SVG 像素位移扭曲，保留霜化 + 饱和度提升 + 圆角，仍是清晰可辨的玻璃面
 */

// 需要在 TopNav 底部填充纯色遮罩的路由（避免漏出页面滚动内容）
// 格式：[路由前缀, PC 端额外底部 padding 高度(px)]
// 仅 PC 生效：H5 sticky 表头紧贴 TopNav 无间隙
const ROUTE_BOTTOM_GAP: [string, number][] = [["/markets/calendar", 20]];

// ─── Navigation Items ───────────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: "home", href: "/home" },
  { key: "markets", href: "/markets" },
  { key: "pools", href: "/liquidity" },
  { key: "stake", href: "/stake" },
  { key: "lend", href: "/lend" },
  { key: "swap", href: "/swap" },
  { key: "referral", href: "/referral" },
  { key: "rewards", href: "/rewards" },
  { key: "oddPresale", href: "/odd-presale" },
] as const;

// DD-119 §3.5 第2层：testnet（!IS_PRESALE_ENABLED）下隐藏认购入口（oddPresale）。
// referral 站点级，不过滤。静态折叠后 testnet bundle 直接砍掉该项。
// DD-146：旧 /invest 入口下线（路由 308 重定向到 /odd-presale）。
// DD-144：lend/swap 上线下架，默认隐藏（见 lib/feature-flags isNavItemLaunchHidden）。
const VISIBLE_NAV_ITEMS = NAV_ITEMS.filter(
  (item) => IS_PRESALE_ENABLED || item.key !== "oddPresale"
).filter((item) => !isNavItemLaunchHidden(item.key));

// ─── Right-side Actions (CSR boundary) ──────────────────────────────────────
// wagmi / authStore / useIsPhone 等客户端 hook 全部在 TopNavActions 内，
// 此处 ssr:false 确保这些 hook 不在 SSR 阶段执行，避免 hydration mismatch。

function TopNavActionsSkeleton() {
  return (
    <div className="flex items-center gap-[8px] lg:gap-[16px] shrink-0">
      <div className="w-[120px] h-[36px] rounded-8 bg-white/[0.08] animate-pulse" />
    </div>
  );
}

const DynamicTopNavActions = dynamic(() => import("./TopNavActions"), {
  ssr: false,
  loading: () => <TopNavActionsSkeleton />,
});

// ─── Main Component ──────────────────────────────────────────────────────────
// PC (Figma 6364:90683 · 2026-05-18 改版): flush 贴顶 + border-b border-divider-light 线分割，去掉旧版 rounded-16 浮动块
// H5 (Figma 816:63077): bg-[#070808] border-b border-[#212124] px-[16px] h-[64px], flush bar — 保持不变
// Landing (/home): 保留原浮动玻璃 bar（hero 沉浸式视觉），其他页走新的线分割样式

export default function TopNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const navRef = useRef<HTMLElement>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const triggerConnect = useWalletSheetStore((s) => s.triggerConnect);

  // landing 页（usePathname 已剥离 locale 前缀）
  const isLanding = pathname === "/home";

  // Auto-scroll to the active nav item on mount / route change
  const scrollToActive = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeEl = nav.querySelector<HTMLElement>("[data-active]");
    if (!activeEl) return;
    // Center the active item within the scrollable nav
    const elRect = activeEl.getBoundingClientRect();
    const scrollLeft = activeEl.offsetLeft - nav.offsetWidth / 2 + elRect.width / 2;
    nav.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToActive();
  }, [pathname, scrollToActive]);

  // landing 页：参考 morpho.org，下滑隐藏 / 上滑显示顶栏
  // - 顶部 80px 内永远显示，避免初始 hero 区轻微滚动就触发隐藏
  // - delta > 4px 才切方向，过滤滚动惯性抖动
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!isLanding) {
      setHidden(false);
      return;
    }
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastY;
        if (currentY < 80) {
          setHidden(false);
        } else if (Math.abs(delta) > 4) {
          setHidden(delta > 0);
        }
        lastY = currentY;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isLanding]);

  const bottomGap = ROUTE_BOTTOM_GAP.find(([route]) => pathname.startsWith(route))?.[1] ?? 0;

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 px-0 pt-0",
        // DD-114: H5 落地页有自己的 header（MobileLandingHeader），TopNav 在 H5 /home 整体隐藏
        isLanding && "max-md:hidden",
        // landing 保留浮动玻璃 bar：PC 外层留 16/24px padding；非 landing 贴顶
        isLanding && "lg:px-[24px] lg:pt-[16px]",
        // landing 透明让玻璃采样 hero；非 landing 纯色背景
        isLanding ? "bg-transparent" : "bg-primary",
        // landing 页滚动方向控制：下滑隐藏 / 上滑显示（transform 不重排，性能安全）
        "transition-transform duration-300 ease-out will-change-transform",
        hidden && "-translate-y-full"
      )}
    >
      {/* PC landing：浮动 bar 上方 16px 留空区纯色填充，避免漏出 Hero 滚动内容；
          H5 无 lg:pt 不需要此层 */}
      {isLanding && (
        <div
          aria-hidden
          className="hidden lg:block pointer-events-none absolute inset-x-0 top-0 h-[16px] bg-primary"
        />
      )}
      {/* Inner bar — 非 landing：贴顶 + 单条 border-b 线分割（PC + H5 一致）
          landing：保留 PC 圆角玻璃霜化（backdrop-blur + 微白底色 + 饱和度提升） */}
      <div
        className={cn(
          "relative flex items-center justify-between h-[64px] px-[16px] lg:px-[24px] border-b border-divider-light",
          isLanding
            ? // landing：H5 半透明纯色；PC 圆角 + 玻璃霜化（60px blur + 180% saturate + 6% 白底色）
              "lg:rounded-16 lg:border-b-0 bg-primary/30 lg:bg-white/[0.06] backdrop-blur-md backdrop-saturate-[1.2] lg:backdrop-blur-[60px] lg:backdrop-saturate-[1.8]"
            : // 非 landing：贴顶纯色 + 单条底分割线（无圆角、无浮动块）
              "bg-primary/90 lg:bg-primary backdrop-blur-md backdrop-saturate-[1.2] lg:backdrop-blur-none lg:backdrop-saturate-100"
        )}
      >
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-[24px] lg:gap-[48px] min-w-0">
          {/* Logo — Figma PC 754:54245→2545:59116 / H5 1330:66456→2545:59840
              PC: gap 8px, icon 32×24, text Orbitron Bold 31px text-primary
              H5: gap 6.154px, icon 24.615×18.462, text Orbitron Bold 23.85px */}
          <Link
            href="/markets"
            className="relative shrink-0 flex items-center gap-[6.154px] lg:gap-[8px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-icon-mint.svg"
              alt=""
              className="w-[24.615px] h-[18.462px] lg:w-[32px] lg:h-[24px]"
            />
            <span className="font-orbitron font-bold text-primary text-[23.85px] lg:text-[31px] leading-normal">
              oddfi
            </span>

            {/* DD-079: Testnet 角标，绝对定位贴在 oddfi 右上方 */}
            {IS_TESTNET && (
              <span className="absolute -top-[6px] left-full -ml-[16px] h-[20px] px-[6px] py-[2px] rounded-8 text-[10px] font-medium leading-[14px] bg-btn-primary text-static-black pointer-events-none select-none flex items-center whitespace-nowrap">
                Testnet
              </span>
            )}
          </Link>

          {/* Nav items — hidden on H5(<md), scrollable on md~lg, static on lg+ */}
          <nav
            ref={navRef}
            className="hidden md:flex items-center gap-[48px] overflow-x-auto overflow-y-hidden scrollbar-hide min-w-0 pr-[16px]"
          >
            {VISIBLE_NAV_ITEMS.map(({ key, href }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  data-active={isActive || undefined}
                  className={`no-underline whitespace-nowrap transition-colors duration-150 min-h-[44px] flex items-center gap-[8px] text-[15px] leading-normal shrink-0 ${
                    isActive
                      ? "font-bold text-brand-default"
                      : "font-medium text-primary hover:opacity-80"
                  }`}
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  {/* 大力神杯导航：market 入口前置奖杯图标（Figma 7729:112479） */}
                  {key === "markets" && <WorldCupTrophyIcon className="h-[24px] w-auto shrink-0" />}
                  {t(key)}
                </Link>
              );
            })}
            {/* AI Agent — 2026-05-18 新增（Figma 6364:90683 · I6364:90683;6364:87742）
                设计稿规格：Noto Sans Medium Italic 16/24 + 渐变文字 + 双 sparkle SVG
                hover：子元素动画提速（group 派发）+ 微 drop-shadow 光晕 + 整体微缩放
                DD-106 Batch 3：button → Link，跳转 /ai-agent 全屏页
                H5-AI-DISABLED: H5 暂不展示 AI 入口，H5 设计稿到位后去掉 hidden lg:flex */}
            {/* @figma-hardcoded: #4AE7DD/#7932EA/#E132EA ai-agent-gradient — pending design token */}
            <Link
              href="/ai-agent"
              className="hidden lg:flex group whitespace-nowrap min-h-[44px] items-center gap-[6px] shrink-0 border-0 bg-transparent p-0 cursor-pointer transition-transform duration-200 hover:scale-[1.06] hover:[filter:drop-shadow(0_0_6px_rgba(74,231,221,0.5))] no-underline"
              aria-label={t("aiAgent")}
              onClick={(e) => {
                if (!isAuthenticated) {
                  e.preventDefault();
                  triggerConnect();
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/ai-agent/sparkle.svg"
                alt=""
                className="w-[18px] h-[14px] shrink-0 animate-ai-pulse-sparkle group-hover:[animation-duration:1.2s]"
              />
              <span
                className="italic font-medium text-[16px] leading-[24px] bg-clip-text text-transparent animate-ai-text-shimmer group-hover:[animation-duration:2.5s]"
                style={{
                  fontFamily: "'Noto Sans', sans-serif",
                  backgroundImage:
                    "linear-gradient(127.906deg, #4AE7DD 9.97%, #7932EA 74.58%, #E132EA 120.91%)",
                }}
              >
                {t("aiAgent")}
              </span>
            </Link>
          </nav>
        </div>

        {/* Right: wagmi / auth / isPhone — CSR only via dynamic import */}
        <DynamicTopNavActions />
      </div>

      {/* Gap cover: fills space between nav bar bottom and sticky header top for routes that need it */}
      {bottomGap > 0 && (
        <div className="hidden lg:block bg-primary" style={{ height: bottomGap }} />
      )}

      {(process.env.NODE_ENV === "development" ||
        process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ||
        process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === "true" ||
        IS_EARLY_BIRD_MODE) && <DevToolsModal />}
    </header>
  );
}
