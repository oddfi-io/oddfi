"use client";

/**
 * SlideVenue — Figma 5107:182955 (Venue 轮播页)
 *
 * main fc2c1e3 的 flex 紧凑布局（适配 140px 容器）+ DD-104 domain prop（distanceKm null guard）。
 */

import Image from "next/image";
import type { MatchVenue } from "@/types/match-detail-domain";

interface Props {
  domain: MatchVenue;
}

export default function SlideVenue({ domain }: Props) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center px-3 py-2.5 gap-1.5"
      data-figma-node="5107:182955"
    >
      <span className="text-[11px] leading-none font-medium text-white/70 uppercase tracking-wide">
        Venue
      </span>

      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <Image
            src="/images/match-detail/venue-stadium.svg"
            alt=""
            width={16}
            height={16}
            unoptimized
          />
          <p className="text-[13px] leading-none font-bold text-white truncate">{domain.name}</p>
        </div>
        <p className="text-[11px] leading-none text-white/70 truncate">{domain.city}</p>
      </div>

      <div className="flex w-full items-center justify-around gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-[12px] leading-none font-bold text-white">
            {domain.capacity.toLocaleString()}
          </p>
          <p className="text-[10px] leading-none text-white/70">Capacity</p>
        </div>
        {domain.distanceKm !== null && (
          <>
            <div className="h-6 w-px bg-white/20" />
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-[12px] leading-none font-bold text-white">
                {domain.distanceKm} km
              </p>
              <p className="text-[10px] leading-none text-white/70">Distance</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
