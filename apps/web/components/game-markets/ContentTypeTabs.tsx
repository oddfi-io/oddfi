"use client";

// ─── Content Type Tabs (Figma 816:63093 / 4402:147606 / 4702:136580) ────────
// H5 only (lg:hidden). Soccer / News / Calendar / Bracket 路由切换。
// active 判定：pathname 含 /calendar → Calendar；含 /bracket → Bracket；其余非 /news → Soccer。
// News 暂 disabled（路由未实现）。

import Image from "next/image";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

const SOCCER_ICON = "/images/sidebar/soccer.png";
const NEWS_ICON = "/images/sidebar/news.png";
const CALENDAR_ICON = "/images/sidebar/calendar.png";
const BRACKET_ICON = "/images/sidebar/bracket.png";

export default function ContentTypeTabs() {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";

  const isCalendar = pathname.includes("/calendar");
  const isBracket = pathname.includes("/bracket");
  const isNews = pathname.includes("/news");
  const isSoccer = !isCalendar && !isBracket && !isNews;

  return (
    <div className="flex items-center gap-[16px] lg:hidden">
      {/* Soccer */}
      <Link
        href={`/${locale}/markets`}
        className={`flex items-center gap-[6px] text-[14px] font-medium leading-[19px] min-h-[44px] whitespace-nowrap transition-colors touch-manipulation
          ${isSoccer ? "text-primary" : "text-tertiary"}`}
      >
        <Image
          src={SOCCER_ICON}
          alt=""
          width={16}
          height={16}
          sizes="16px"
          className="w-[16px] h-[16px]"
        />
        Soccer
      </Link>

      {/* News — disabled until route is implemented */}
      <span
        className="flex items-center gap-[6px] text-[14px] font-medium leading-[19px] min-h-[44px] whitespace-nowrap text-tertiary cursor-not-allowed opacity-50"
        aria-disabled="true"
      >
        <Image
          src={NEWS_ICON}
          alt=""
          width={16}
          height={16}
          sizes="16px"
          className="w-[16px] h-[16px]"
        />
        News
      </span>

      {/* Calendar */}
      <Link
        href={`/${locale}/markets/calendar`}
        className={`flex items-center gap-[6px] text-[14px] font-medium leading-[19px] min-h-[44px] whitespace-nowrap transition-colors touch-manipulation
          ${isCalendar ? "text-primary border-b border-primary" : "text-tertiary"}`}
      >
        <Image
          src={CALENDAR_ICON}
          alt=""
          width={16}
          height={16}
          sizes="16px"
          className="w-[16px] h-[16px]"
        />
        Calendar
      </Link>

      {/* Bracket — DD-095 入口 */}
      <Link
        href={`/${locale}/markets/bracket`}
        className={`flex items-center gap-[6px] text-[14px] font-medium leading-[19px] min-h-[44px] whitespace-nowrap transition-colors touch-manipulation
          ${isBracket ? "text-brand-default border-b border-brand-default" : "text-tertiary"}`}
      >
        <Image
          src={BRACKET_ICON}
          alt=""
          width={16}
          height={16}
          sizes="16px"
          className="w-[16px] h-[16px]"
        />
        Bracket
      </Link>
    </div>
  );
}
