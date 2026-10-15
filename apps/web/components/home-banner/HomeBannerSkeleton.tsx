/**
 * HomeBanner 骨架 — 3 张 372×162 横向占位（与新推广卡 DD-143 同尺寸，避免加载完成布局跳变）
 */
export default function HomeBannerSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex-shrink-0 rounded-[16px] animate-pulse"
          style={{
            width: 372,
            height: 162,
            // @figma-hardcoded: rgba(255,255,255,0.06) skeleton-bg — pending design token
            background: "rgba(255,255,255,0.06)",
          }}
        />
      ))}
    </div>
  );
}
