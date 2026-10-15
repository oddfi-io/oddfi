"use client";

import Image from "next/image";
import Link from "next/link";
import BackIcon from "@/components/icons/BackIcon";
import type { SportmonksFixture } from "@/types/api";
import { formatMatchDate, formatMatchTime, parseMatchTime } from "@/lib/format-utils";
import {
  STAT_CATEGORIES,
  STAT_ICONS,
  getStatValue,
} from "@/components/game-markets/MatchDetailPanel";

// ─── MatchHeader ────────────────────────────────────────────────────────────
// PC: centered team layout with VS separator (existing design)
// H5 (Figma 842:65184 + 842:65524): back header + banner with bg image + team rows + form

interface MatchHeaderProps {
  fixture: SportmonksFixture;
  leagueName: string;
  locale: string;
  mode?: "page" | "panel";
}

export default function MatchHeader({
  fixture,
  leagueName,
  locale,
  mode = "page",
}: MatchHeaderProps) {
  const home = fixture.participants.find((p) => p.meta.location === "home");
  const away = fixture.participants.find((p) => p.meta.location === "away");
  const stats = fixture.statistics;

  return (
    <>
      {/* H5: Separate header bar (Figma 842:65184) — back arrow + match title */}
      {mode === "page" && (
        <div className="lg:hidden flex items-center gap-[16px] h-[64px] min-h-[48px] px-[16px] bg-primary border-b border-secondary sticky top-0 z-10">
          <Link
            href={`/${locale}/markets`}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
          >
            <div className="size-[32px] flex items-center justify-center rounded-8 bg-tertiary">
              <BackIcon size={20} className="text-white" />
            </div>
          </Link>
          <span className="text-[14px] font-semibold text-primary truncate leading-[19px]">
            {home?.name ?? "—"} vs. {away?.name ?? "—"}
          </span>
        </div>
      )}

      {/* H5: Banner with background image (Figma 842:65524) */}
      <div className="lg:hidden relative w-full h-[198px] overflow-hidden">
        {/* Background — gradient fallback (replace with bg image when asset is available) */}
        <div
          className="absolute inset-0"
          style={{
            // @figma-hardcoded: linear-gradient(135deg, #0a1628, #1a2a3e, #0d1f30) match-banner-gradient — decorative, pending design token
            background: "linear-gradient(135deg, #0a1628 0%, #1a2a3e 40%, #0d1f30 100%)",
          }}
        />
        <div className="absolute inset-0 bg-black/50" />

        {/* Match info card — Figma 842:65572: centered, bg rgba(23,24,29,0.9), border #37393a */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] rounded-12 bg-[rgba(23,24,29,0.9)] border border-DEFAULT p-[16px] flex flex-col gap-[12px]">
          {/* Row 1: Date/Time + Stat category icons — Figma 842:65573 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[7px]">
              <span className="text-[11px] text-secondary leading-normal">
                {formatMatchDate(fixture.starting_at, locale)}
              </span>
              <span className="text-[11px] text-secondary leading-normal">
                {formatMatchTime(fixture.starting_at, locale)}
              </span>
            </div>
            <div className="flex items-center gap-[8px] shrink-0">
              {STAT_CATEGORIES.map((cat) => {
                const icon = STAT_ICONS[cat.key];
                return (
                  <div key={cat.key} className="size-[16px] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={icon.src} alt={icon.alt} className="size-[16px]" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Row 2: Home team + stats — Figma 842:65589 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[7px] min-w-0 flex-1">
              {home?.image_path && (
                <Image
                  src={home.image_path}
                  alt=""
                  width={20}
                  height={20}
                  sizes="20px"
                  className="rounded-full object-cover shrink-0 border border-white/20"
                />
              )}
              <span className="text-[12px] text-primary leading-[18px] truncate">
                {home?.name ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-[8px] shrink-0">
              {STAT_CATEGORIES.map((cat) => (
                <span
                  key={cat.key}
                  className="text-[12px] text-primary leading-[18px] w-[16px] text-center"
                >
                  {getStatValue(stats, cat.typeId, "home")}
                </span>
              ))}
            </div>
          </div>

          {/* Row 3: Away team + stats — Figma 842:65599 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[7px] min-w-0 flex-1">
              {away?.image_path && (
                <Image
                  src={away.image_path}
                  alt=""
                  width={20}
                  height={20}
                  sizes="20px"
                  className="rounded-full object-cover shrink-0 border border-white/20"
                />
              )}
              <span className="text-[12px] text-primary leading-[18px] truncate">
                {away?.name ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-[8px] shrink-0">
              {STAT_CATEGORIES.map((cat) => (
                <span
                  key={cat.key}
                  className="text-[12px] text-primary leading-[18px] w-[16px] text-center"
                >
                  {getStatValue(stats, cat.typeId, "away")}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PC: existing centered layout (preserved) */}
      {/* @figma-hardcoded: #292B32 match-card-border — pending design token */}
      <div className="hidden lg:block rounded-8 overflow-hidden bg-secondary border border-[#292B32]">
        {mode === "page" && (
          <div className="px-4 py-3 flex items-center gap-3 border-b border-[#292B32]">
            <Link
              href={`/${locale}/markets`}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-8 hover:bg-white/[0.06] transition-colors -ml-2"
            >
              <BackIcon size={20} className="text-secondary" />
            </Link>
            <span className="text-sm font-semibold text-primary">{leagueName}</span>
          </div>
        )}

        <div className="px-6 py-5 space-y-4">
          <div className="text-center text-xs text-secondary">
            {parseMatchTime(fixture.starting_at).toLocaleString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
              month: "numeric",
              day: "numeric",
              year: "numeric",
            })}
          </div>

          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2 min-w-[100px]">
              {home?.image_path && (
                <Image
                  src={home.image_path}
                  alt=""
                  width={48}
                  height={48}
                  sizes="48px"
                  className="rounded-full object-cover"
                />
              )}
              <span className="text-sm font-medium text-primary text-center">
                {home?.name ?? "—"}
              </span>
            </div>
            <div className="text-lg font-bold text-tertiary">vs</div>
            <div className="flex flex-col items-center gap-2 min-w-[100px]">
              {away?.image_path && (
                <Image
                  src={away.image_path}
                  alt=""
                  width={48}
                  height={48}
                  sizes="48px"
                  className="rounded-full object-cover"
                />
              )}
              <span className="text-sm font-medium text-primary text-center">
                {away?.name ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
