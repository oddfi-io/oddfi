"use client";

import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { HomeBannerData } from "@/types/home-banner";
import BannerSwitcher from "./BannerSwitcher";

interface ScaledBannerCardProps {
  data: HomeBannerData;
  priority?: boolean;
}

/**
 * 将 640×360 的 BannerSwitcher 等比缩放至 320×180 展示（Figma 3231:46620）
 * rounded-[32px] 经 scale(0.5) 视觉呈 rounded-[16px]
 *
 * Phase 2（DD-085）：整卡 click → router.push 详情页
 *  - BetButton 通过 stopPropagation 阻止冒泡（点 Bet 不跳转）
 *  - 键盘 Enter/Space 等价 click（a11y）
 */
export default function ScaledBannerCard({ data, priority = false }: ScaledBannerCardProps) {
  const router = useRouter();
  if (data.items.length === 0) return null;

  const handleClick = () => {
    router.push(`/markets/banner/${data.template_id}`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Open banner detail: ${data.title}`}
      className="flex-shrink-0 cursor-pointer overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-default"
      style={{ width: 320, height: 180 }}
    >
      <div
        style={{
          width: 640,
          height: 360,
          transform: "scale(0.5)",
          transformOrigin: "top left",
        }}
      >
        <BannerSwitcher data={data} priority={priority} />
      </div>
    </div>
  );
}
