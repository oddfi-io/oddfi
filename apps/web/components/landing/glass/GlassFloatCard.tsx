"use client";

import LiquidGlass from "liquid-glass-react";

/**
 * §3 群星落幕浮卡（Figma symbol 3656:131386 "Overlay+OverlayBlur"）
 *
 * 单卡 327×447，圆角 20px。卡底色由 LiquidGlass（rdev/liquid-glass-react）实现 Apple 液态玻璃效果。
 * - 球员图层由调用方通过 children 传入（每个球星卡有不同 inset/offset，见 MatchesGlassWall）
 *   外层 502×383 wrapper（top -67 left -21）允许从卡顶超出，让球员头部可见在卡外
 * - LiquidGlass 作为 sibling 渲染在 player wrapper 之前（DOM 顺序在前 → painters' order 在下）
 *   球员浮在玻璃之上保持清晰，玻璃只贡献边框高光 / 投影 / 微折射卡内空白区
 * - 底部白色 paragraph 卡片：bg-white 圆角 16px，内 px-15/py-16
 */
export interface GlassFloatCardProps {
  name: string;
  description: string;
  className?: string;
  style?: React.CSSProperties;
  /** 球员图层（在 502×383 wrapper 内 absolute 定位，遵循 Figma 节点结构） */
  children?: React.ReactNode;
}

export default function GlassFloatCard({
  name,
  description,
  className,
  style,
  children,
}: GlassFloatCardProps) {
  return (
    <div
      data-figma-node="3656:131386"
      data-name="GlassFloatCard"
      // 不带 position class — 由调用方决定（MatchesGlassWall 传 absolute；absolute 自身合法 containing block）
      className={["h-[447px] w-[327px]", className ?? ""].join(" ")}
      style={style}
    >
      {/* 液态玻璃底层 — DOM 顺序在球员前面，painters' order 让球员浮在玻璃之上不被模糊
          - LiquidGlass 由 children 尺寸 + padding 决定自身大小，故传 327×447 占位 div + padding="0"
          - 内部 ResizeObserver 读取 GlassContainer 实际尺寸后驱动 SVG displacement filter
          - top/left=50% + 库内固定的 transform: translate(-50%, -50%) → glass 左上对齐 card 左上
            （库设计为按钮样式：把中心点放在指定坐标，靠 transform 居中。我们要"填充父级"得反向利用）
          - Safari/Firefox 不支持 displacement filter，会回落到模糊 + 饱和度（仍可见玻璃感） */}
      <LiquidGlass
        cornerRadius={20}
        blurAmount={0.04}
        displacementScale={25}
        saturation={110}
        aberrationIntensity={0.8}
        elasticity={0}
        padding="0"
        style={{ position: "absolute", top: "50%", left: "50%" }}
      >
        <div style={{ width: 327, height: 447 }} />
      </LiquidGlass>

      {/* 球员图层 wrapper（502×383）作 Figma frame 等价物 — 渲染在 LiquidGlass 之后，浮于玻璃上层
          - clip-path inset：底部 0 保持裁切（脚不漏出卡底），上/左/右各扩 200px 宽容
            允许举手（Modric top 溢出）和张臂（C罗 左右溢出）自然超出 wrapper 显示
          - overflow-hidden 已移除——改用 clip-path 单边裁底，保留三侧溢出空间 */}
      <div
        className="pointer-events-none absolute left-[-21px] top-[-67px] h-[502px] w-[383px]"
        style={{ clipPath: "inset(-200px -200px 0 -200px)" }}
      >
        {children}
      </div>

      {/* 底部白色 paragraph 卡片 — 放在 LiquidGlass 外作兄弟节点
          相对 GlassFloatCard 最外层 absolute 元素定位（absolute 元素自身是合法 containing block） */}
      <div
        data-name="Paragraph+Background"
        className="absolute bottom-[12px] left-1/2 w-[303px] -translate-x-1/2 rounded-[16px] bg-white px-[15px] py-[16px]"
      >
        {/* @figma-hardcoded: #0b0d13 glass-paragraph-title — pending design token */}
        <p className="font-noto-sc text-[20px] font-bold leading-[28px] text-[#0b0d13]">{name}</p>
        {/* @figma-hardcoded: rgba(11,13,19,0.7) glass-paragraph-desc — pending design token */}
        <p className="mt-[3px] font-noto-sc text-[14.4px] font-normal leading-[24px] text-[rgba(11,13,19,0.7)]">
          {description}
        </p>
      </div>
    </div>
  );
}
