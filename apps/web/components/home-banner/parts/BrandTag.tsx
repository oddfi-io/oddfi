import Image from "next/image";
import { BANNER_TAG_ICONS } from "@/lib/home-banner-decorations";

interface BrandTagProps {
  /** 大写标签文案，如 "HOT MARKET" */
  label: string;
  /** 动态配色（CSS background 字符串，来自后端 tag_color；可为纯色或渐变） */
  color: string;
  /** 文字色，默认白；B3 GOLDEN BALL 为黑 */
  textColor?: string;
}

/**
 * 左上角品牌标签条（Figma 3231:413 等）
 * 宽度由内容 hug，固定高度 39.188；Orbitron Black 18.123px 大写
 *
 * 形状（所有 banner 通用）：
 *   - 左/上/左下：直角
 *   - 右下：39.188×39.1875 椭圆圆角（对应 Figma SVG `M0 0H209C209 21.6427 191.455 39.1875 169.812 39.1875H0V0Z`
 *     的右侧贝塞尔曲线，宽度自适应不变形）
 *
 * 布局（inline-flex）：
 *   - paddingLeft: 18（图标到左边缘）
 *   - paddingRight: 30（文字到右边缘 / 右下异形弧区域留白）
 *   - gap: 4.5（图标与文字间距，参照 Figma 41.2 − 36.676 ≈ 4.52）
 */
export default function BrandTag({ label, color, textColor = "#ffffff" }: BrandTagProps) {
  const iconSrc = BANNER_TAG_ICONS[label];

  return (
    <div
      className="inline-flex items-center flex-shrink-0"
      style={{
        height: 39.188, // @figma intentional non-integer
        paddingLeft: 18,
        paddingRight: 30,
        gap: 4.5,
        background: color,
        // Figma SVG 右下异形弧的 CSS 等价：水平 39.188 垂直 39.1875 椭圆角
        borderBottomRightRadius: "39.188px 39.1875px",
      }}
    >
      {iconSrc && (
        <Image
          src={iconSrc}
          alt=""
          width={20}
          height={20}
          sizes="20px"
          style={{ width: 19.256, height: 19.256, flexShrink: 0 }}
        />
      )}
      <span
        className="font-orbitron font-black uppercase whitespace-nowrap"
        style={{
          fontSize: 18.123, // @figma intentional non-integer
          lineHeight: 1.8,
          color: textColor,
          letterSpacing: -0.1812,
        }}
      >
        {label}
      </span>
    </div>
  );
}
