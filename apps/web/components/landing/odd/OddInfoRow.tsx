import Image from "next/image";

export type OddInfoRowProps = {
  /** 行左侧标签（如 "代币名称" / "总发行量"） */
  label: string;
  /** 行右侧主值文案 */
  value: string;
  /** 可选的右侧图标（链 / 代币 / DEX logo） */
  icon?: {
    src: string;
    alt: string;
    /** size in px, default 24 */
    size?: number;
    /** 是否使用 object-cover（PNG 头像类） */
    objectCover?: boolean;
  };
};

/**
 * §7 ODD Token 信息行（Figma 节点 4197:169465）
 * 64px 高，左标签 + 右值（带可选图标）。
 */
export default function OddInfoRow({ label, value, icon }: OddInfoRowProps) {
  return (
    <div
      // @figma-hardcoded: rgba(33,33,36,0.8) row-bg, rgba(255,255,255,0.08) row-border — pending design token
      className="flex h-[64px] w-full items-center justify-between rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[rgba(33,33,36,0.8)] px-[19px] py-[16px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
    >
      {/* @figma-hardcoded: #b9b9b9 row-label — pending design token */}
      <span className="text-[14px] leading-[19px] text-[#b9b9b9]">{label}</span>
      <div className="flex items-center gap-[10px]">
        {icon ? (
          <span
            className="relative shrink-0 overflow-hidden rounded-full"
            style={{ width: icon.size ?? 24, height: icon.size ?? 24 }}
          >
            <Image
              src={icon.src}
              alt={icon.alt}
              fill
              sizes={`${icon.size ?? 24}px`}
              className={icon.objectCover ? "object-cover" : "object-contain"}
            />
          </span>
        ) : null}
        <span className="text-[16px] font-bold leading-[24px] text-primary">{value}</span>
      </div>
    </div>
  );
}
