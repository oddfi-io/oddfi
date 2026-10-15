/**
 * Roadmap timeline 月份标记图标（Figma 节点 4218:191784）
 * 由日期标签（July）+ 数字（6/7/8/...）+ 月字组成；颜色取自 design tokens。
 *
 * 已查 ASSETS.md（关键词：roadmap, timeline, marker）— 无替代，新建理由：
 * Roadmap timeline 专用月份标记，含 Figma 硬编码 hex（#8e8e92, #f4f5f7），
 * 仅本组件使用，封装为 React 组件以避免业务组件内裸 SVG。
 */
type Props = {
  month: number;
  label: string;
  className?: string;
};

export default function RoadmapMarkerIcon({ month, label, className }: Props) {
  return (
    <div className={`flex flex-col items-start gap-[4px] ${className ?? ""}`}>
      <p
        // @figma-hardcoded: #8e8e92 roadmap-marker-label — pending design token
        className="font-noto-sc text-[18px] font-normal leading-[26px] text-[#8e8e92]"
      >
        {label}
      </p>
      <div className="flex items-baseline gap-[6px] whitespace-nowrap">
        <span
          // @figma-hardcoded: #f4f5f7 roadmap-marker-num — pending design token
          className="font-noto-sc text-[36px] font-bold leading-none text-[#f4f5f7]"
        >
          {month}
        </span>
        <span
          // @figma-hardcoded: #8e8e92 roadmap-marker-unit — pending design token
          className="font-noto-sc text-[19.1px] font-bold leading-[28px] text-[#8e8e92]"
        >
          月
        </span>
      </div>
    </div>
  );
}
