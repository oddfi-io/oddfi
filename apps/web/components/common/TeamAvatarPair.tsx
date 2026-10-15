"use client";

import Image from "next/image";
import { useState } from "react";

interface TeamAvatarPairProps {
  homeTeamLogo: string;
  awayTeamLogo: string;
  /** Container size in px. Each badge = size * 0.75. Default 32. */
  size?: number;
  className?: string;
}

/**
 * Overlapping home/away team badge pair.
 * Figma 2056:93648 — home badge top-left, away badge bottom-right (diagonal).
 * Gradient ring frames each badge; away badge has a dark separator border.
 */
export default function TeamAvatarPair({
  homeTeamLogo,
  awayTeamLogo,
  size = 32,
  className = "",
}: TeamAvatarPairProps) {
  const [homeError, setHomeError] = useState(false);
  const [awayError, setAwayError] = useState(false);
  const badgeSize = Math.round(size * 0.75);

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {/* Home team — top-left, gradient ring */}
      {/* @figma-hardcoded: from-[#f7fafc] to-[#d4dce3] badge-ring-gradient — pending design token */}
      <div
        className="absolute left-0 top-0 rounded-full bg-gradient-to-t from-[#f7fafc] to-[#d4dce3]"
        style={{ width: badgeSize, height: badgeSize }}
      >
        <div className="absolute rounded-full overflow-hidden" style={{ inset: "1.4px" }}>
          {homeError ? (
            <div className="size-full rounded-full bg-white/10" />
          ) : (
            <Image
              src={homeTeamLogo}
              alt=""
              fill
              sizes={`${badgeSize}px`}
              className="object-cover"
              onError={() => setHomeError(true)}
            />
          )}
        </div>
      </div>

      {/* Away team — bottom-right, gradient ring + dark separator border */}
      {/* @figma-hardcoded: from-[#f7fafc] to-[#d4dce3] badge-ring-gradient, #04060c badge-separator-border — pending design token */}
      <div
        className="absolute right-0 bottom-0 rounded-full bg-gradient-to-t from-[#f7fafc] to-[#d4dce3]"
        style={{ width: badgeSize, height: badgeSize, border: "1.5px solid #04060c" }}
      >
        <div className="absolute rounded-full overflow-hidden" style={{ inset: "0.5px" }}>
          {awayError ? (
            <div className="size-full rounded-full bg-white/10" />
          ) : (
            <Image
              src={awayTeamLogo}
              alt=""
              fill
              sizes={`${badgeSize}px`}
              className="object-cover"
              onError={() => setAwayError(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
