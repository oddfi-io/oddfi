"use client";

/**
 * AiInsightIcon — DD-102 Moneyline teaser 左侧 AI 提示图标。
 *
 * 视觉构成（DD-102 走查修订）：
 *   - 32×32 容器
 *   - 主体：TokenIconWithChain 渲染平台币（自动展示 PLATFORM_TOKEN 图标 + 链 badge）
 *   - 右上角扣出：14×14 暗色徽章 (#141114) 内含 ✨ emoji，标识 AI 解读
 */
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import { PLATFORM_TOKEN_DISPLAY, PLATFORM_TOKEN } from "@/lib/platform-token";

export default function AiInsightIcon({ size = 32 }: { size?: number }) {
  const badgeSize = Math.round((size * 14) / 32);
  const tokenSize = Math.round(size * 0.875); // 28 at size=32

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      {/* 平台币图标（TokenIconWithChain — 仅展示平台币，不显示链 badge），定位在左下 */}
      <div className="absolute bottom-0 left-0">
        <TokenIconWithChain
          tokenSymbol={PLATFORM_TOKEN_DISPLAY}
          tokenIconUrl={PLATFORM_TOKEN.iconUrl}
          size={tokenSize}
          hideChainBadge
        />
      </div>

      {/* 右上角 ✨ 徽章 — 标识 AI 解读 */}
      {/* @figma-hardcoded: #141114 sparkle-badge-bg — pending design token */}
      <div
        className="absolute rounded-full flex items-center justify-center"
        style={{
          top: 0,
          right: 0,
          width: badgeSize,
          height: badgeSize,
          backgroundColor: "#141114",
        }}
      >
        <span className="leading-none" style={{ fontSize: Math.round(size * 0.31) }}>
          ✨
        </span>
      </div>
    </div>
  );
}
