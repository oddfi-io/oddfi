import Image from "next/image";

export type AiAgentCardProps = {
  /** 卡片图标 SVG 路径 */
  iconSrc: string;
  iconAlt: string;
  /** 图标实际尺寸（Figma 给的真实大小，外圆 128px 不变） */
  iconSize?: { width: number; height: number };
  title: string;
  description: string;
};

/**
 * §9 AI Agent 卡片（Figma 节点 4227:195244-246 — card2 instance）
 *
 * Phase 1 静态版：圆形 ic 容器 (128px) + 标题 + 描述
 * 卡片底色 #101010，圆角 20，纵向 56px padding。
 */
export default function AiAgentCard({
  iconSrc,
  iconAlt,
  iconSize = { width: 52, height: 52 },
  title,
  description,
}: AiAgentCardProps) {
  return (
    <div
      // @figma-hardcoded: #101010 ai-card-bg — pending design token
      className="flex flex-1 flex-col items-center gap-[40px] rounded-[20px] bg-[#101010] py-[56px]"
    >
      {/* ic 圆形容器 128x128 */}
      <div
        // @figma-hardcoded: rgba(255,255,255,0.1) ic-border — pending design token
        className="flex size-[128px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(255,255,255,0.1)] p-[40px]"
      >
        <span
          className="relative shrink-0"
          style={{ width: iconSize.width, height: iconSize.height }}
        >
          <Image
            src={iconSrc}
            alt={iconAlt}
            fill
            sizes={`${Math.max(iconSize.width, iconSize.height)}px`}
            className="object-contain"
          />
        </span>
      </div>
      {/* 文案区 */}
      <div className="flex w-full flex-col items-start gap-[24px] px-[24px] text-center">
        {/* @figma-hardcoded: #f1f1ef ai-card-title — pending design token */}
        <h3 className="w-full text-[24px] font-bold leading-normal text-[#f1f1ef]">{title}</h3>
        {/* @figma-hardcoded: #adadad ai-card-desc — pending design token */}
        <p className="w-full text-[16px] leading-[24px] text-[#adadad]">{description}</p>
      </div>
    </div>
  );
}
