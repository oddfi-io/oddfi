import Image from "next/image";

interface HeatFlamesProps {
  /** 热度 0-5。Figma B1 visual shows varied 3/2/1/0 per rank */
  heat: number;
}

/**
 * B1 热度 🔥 组件（Figma 3231:427-429）
 * 17×17 火焰图标，错位 -2px 叠加，clamp 到 0-5
 * heat=0 → 不渲染
 *
 * 资源：/banner/icons/fire.png（从 Figma 导出）
 */
export default function HeatFlames({ heat }: HeatFlamesProps) {
  const count = Math.max(0, Math.min(5, Math.floor(heat)));
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center flex-shrink-0">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="inline-block"
          style={{ width: 17, height: 17, marginLeft: i === 0 ? 0 : -2 }}
        >
          <Image src="/banner/icons/fire.png" alt="" width={17} height={17} sizes="17px" />
        </span>
      ))}
    </span>
  );
}
