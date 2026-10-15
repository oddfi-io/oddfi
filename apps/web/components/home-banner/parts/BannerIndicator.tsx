"use client";

/**
 * 推广 banner 进度指示条（DD-143 · Figma 8487:133849）
 *
 * 72×3 轨道（bg-tertiary）+ 40px 白色滑块，随 activeIndex 在轨道内左右滑动。
 * 非分段圆点：滑块固定 40px，滑动范围 = 72-40 = 32px，N 张卡均分 → 每步 32/(N-1)px。
 * 与无限滚动天然契合（连续条，归一瞬移因 activeIndex 取模不变而不闪，见 HomeBannerCarousel）。
 * 纯 CSS transition 平滑滑动（无状态生命周期，animation.md 例外）。
 */
const TRACK_WIDTH = 72;
const THUMB_WIDTH = 40;

interface BannerIndicatorProps {
  /** 卡片总数 N */
  count: number;
  /** 当前领先卡 index（0..N-1） */
  activeIndex: number;
}

export default function BannerIndicator({ count, activeIndex }: BannerIndicatorProps) {
  if (count <= 1) return null;

  const clamped = Math.min(Math.max(activeIndex, 0), count - 1);
  const left = (clamped / (count - 1)) * (TRACK_WIDTH - THUMB_WIDTH);

  return (
    <div aria-hidden="true" className="relative h-[3px] w-[72px] rounded-full bg-tertiary">
      <div
        className="absolute top-0 h-[3px] rounded-full bg-white transition-[left] duration-300 ease-out"
        style={{ width: THUMB_WIDTH, left }}
      />
    </div>
  );
}
