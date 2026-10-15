"use client";

import Image from "next/image";
import { useState } from "react";

interface SportIconProps {
  src: string;
  alt?: string;
  /** 图标基础尺寸 (px)，默认 24。传入 className 控制尺寸时可省略 */
  size?: number;
  /** 是否显示白色渐变背景圆形底层（解决暗色图标在深色主题下不可见） */
  withBg?: boolean;
  /** 额外 CSS class，可用于响应式尺寸如 "size-[16px] lg:size-[24px]" */
  className?: string;
  /** 首屏 LCP 图标加 preload hint（每页严格 ≤2 个） */
  priority?: boolean;
}

export default function SportIcon({
  src,
  alt = "",
  size = 24,
  withBg = true,
  className,
  priority = false,
}: SportIconProps) {
  const [imgError, setImgError] = useState(false);
  const sizeStyle = className ? undefined : { width: size, height: size };

  if (imgError) {
    return (
      <div
        className={`rounded-full shrink-0 bg-white/10${className ? ` ${className}` : ""}`}
        style={sizeStyle}
      />
    );
  }

  if (withBg) {
    return (
      <div
        className={`relative rounded-full shrink-0 bg-gradient-to-t from-[#f7fafc] to-[#d4dce3] border-[1.2px] border-[#f7fafc]${className ? ` ${className}` : ""}`}
        style={sizeStyle}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={`${size}px`}
          className="rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      sizes={`${size}px`}
      className={`rounded-full object-cover shrink-0${className ? ` ${className}` : ""}`}
      onError={() => setImgError(true)}
    />
  );
}
