import Image from "next/image";

/**
 * 大力神杯（FIFA 世界杯奖杯）导航图标 —— Figma 节点 7729:112665 导出。
 * 品牌定制 raster 图标，固定金色，不随 active 态变色（与可变色 Phosphor 图标不同）。
 * 装饰性元素：aria-hidden + 空 alt，文案由相邻的 "World Cup" 文字承载。
 * 显示尺寸由调用方通过 className 控制（如 h-[24px] w-auto），宽高比由 56×120 源约束。
 */
export default function WorldCupTrophyIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/images/nav/world-cup-trophy.png"
      alt=""
      aria-hidden
      width={56}
      height={120}
      sizes="56px"
      className={className}
    />
  );
}
