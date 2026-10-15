import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";

interface BannerFrameProps {
  /** 左上标签槽（<BrandTag>） */
  tag: ReactNode;
  /** 标题槽（各 banner 内联实现，B1 纯色 / B3-B5 渐变） */
  title: ReactNode;
  /** 副标题（B2 球员信息） */
  subtitle?: ReactNode;
  /** 背景装饰层槽（Figma B1/B2 多层 rectangle 斜切色块等）；位于深色底之上、illustration 之下 */
  backdrop?: ReactNode;
  /** 右侧装饰图路径（/banner/illustrations/*.png） */
  illustration?: string;
  /** 装饰图绝对定位样式（left/top/width/height 均以 640×360 banner 坐标系）；未传则默认 inset-0 object-right */
  illustrationStyle?: CSSProperties;
  /** 赔率行/stats 列表槽 */
  children: ReactNode;
  /** 背景色覆盖，默认 Figma 深蓝 */
  background?: string;
  /** 内容区 padding（像素），未传则用 legacy 值 {top:76, right:20, bottom:20, left:20} */
  bodyPadding?: { top: number; right: number; bottom: number; left: number };
  /** 赔率行之间的垂直间距（像素），默认 8（gap-2 legacy） */
  rowGap?: number;
  className?: string;
  priority?: boolean;
}

/**
 * Banner 外层骨架（Figma 3104:43822 抽象）
 * 640×360 rounded-[32px]，深蓝底 + 左上 tag + 标题 + 右侧装饰 + 底部内容
 *
 * 布局分层：
 *   绝对定位：装饰层（z-0）、tag（左上 z-20）
 *   相对文档流：title / subtitle / children（z-10）
 */
export default function BannerFrame({
  tag,
  title,
  subtitle,
  backdrop,
  illustration,
  illustrationStyle,
  children,
  // @figma-hardcoded: #11139a banner-bg — pending design token
  background = "#11139a",
  bodyPadding = { top: 76, right: 20, bottom: 20, left: 20 },
  rowGap = 8,
  className = "",
  priority = false,
}: BannerFrameProps) {
  return (
    <div
      className={`relative overflow-hidden flex-shrink-0 ${className}`}
      style={{
        width: 640,
        height: 360,
        borderRadius: 32,
        background,
      }}
    >
      {backdrop && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">{backdrop}</div>
      )}

      {illustration &&
        (illustrationStyle ? (
          <div
            className="absolute z-0 pointer-events-none"
            style={{ position: "absolute", ...illustrationStyle }}
          >
            <Image
              src={illustration}
              alt=""
              fill
              sizes="640px"
              className="object-contain"
              priority={priority}
            />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <Image
              src={illustration}
              alt=""
              fill
              sizes="640px"
              className="object-contain object-right"
              priority={priority}
            />
          </div>
        ))}

      {/* Figma 3231:413 / 3110:49540 tag 容器贴左上角（left=-1 top=0） */}
      <div className="absolute z-20" style={{ top: 0, left: -1 }}>
        {tag}
      </div>

      <div
        className="relative z-10 h-full flex flex-col"
        style={{
          paddingTop: bodyPadding.top,
          paddingRight: bodyPadding.right,
          paddingBottom: bodyPadding.bottom,
          paddingLeft: bodyPadding.left,
        }}
      >
        <div className="flex-shrink-0">
          {title}
          {subtitle && <div className="mt-1">{subtitle}</div>}
        </div>
        <div className="mt-auto flex flex-col" style={{ gap: rowGap }}>
          {children}
        </div>
      </div>
    </div>
  );
}
