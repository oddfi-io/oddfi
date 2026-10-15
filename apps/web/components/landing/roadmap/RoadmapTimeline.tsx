import RoadmapMarkerIcon from "@/components/icons/landing/RoadmapMarkerIcon";

/**
 * Roadmap 时间轴（Figma 节点 4227:195287）
 *
 * 结构：
 * - 水平直线（horizontal stroke）跨容器宽度，opacity 0.6, color #27282B
 * - 左右两条短竖线（vertical stroke）在 9.94% / 91.82% 位置，高 109.28px
 * - 左右两侧菱形 fill 区域（timeline-fill-1/2.svg 的对角斜线纹理填充），opacity 0.6
 * - 7 个月份 marker（July 6 月 → July 12 月），底部 49.98px 偏移横向均匀分布
 *
 * Phase 1 静态版：路径完整画好显示，不做 strokeDashoffset 100→0 路径绘制动画，
 * 不做 7 节点 stagger 沿路径点燃。
 */

const MONTHS: { num: number; label: string }[] = [
  { num: 6, label: "June" },
  { num: 7, label: "July" },
  { num: 8, label: "August" },
  { num: 9, label: "September" },
  { num: 10, label: "October" },
  { num: 11, label: "November" },
  { num: 12, label: "December" },
];

export default function RoadmapTimeline() {
  return (
    <div className="relative h-[123px] w-[1200px]">
      {/* SVG 时间轴层 */}
      <svg
        className="absolute left-0 top-0 h-[110px] w-[1200px]"
        viewBox="0 0 1200 110"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* 水平主线（全宽） */}
        <line
          x1="0"
          y1="35.1"
          x2="1199.83"
          y2="35.1"
          // @figma-hardcoded: #27282B timeline-stroke — pending design token
          stroke="#27282B"
          strokeOpacity="0.6"
        />
        {/* 左侧竖线 */}
        <line
          x1="119.34"
          y1="0.49"
          x2="119.34"
          y2="109.78"
          // @figma-hardcoded: #27282B timeline-stroke — pending design token
          stroke="#27282B"
          strokeOpacity="0.6"
        />
        {/* 右侧竖线 */}
        <line
          x1="1101.81"
          y1="0.49"
          x2="1101.81"
          y2="109.78"
          // @figma-hardcoded: #27282B timeline-stroke — pending design token
          stroke="#27282B"
          strokeOpacity="0.6"
        />
        {/* 左侧菱形对角斜线纹理 — 通过 mask 把 timeline-fill-1.svg 限制在 491×75 矩形内 */}
        <foreignObject x="119.58" y="35.04" width="491.23" height="75.2">
          <div
            // @ts-expect-error -- foreignObject 内嵌 div 的 React 类型限制
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              width: "100%",
              height: "100%",
              opacity: 0.6,
              maskImage: "url(/images/landing/roadmap/timeline-mask-1.svg)",
              maskSize: "100% 100%",
              maskRepeat: "no-repeat",
              WebkitMaskImage: "url(/images/landing/roadmap/timeline-mask-1.svg)",
              WebkitMaskSize: "100% 100%",
              WebkitMaskRepeat: "no-repeat",
              backgroundImage: "url(/images/landing/roadmap/timeline-fill-1.svg)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "left top",
            }}
          />
        </foreignObject>
        {/* 右侧菱形对角斜线纹理 */}
        <foreignObject x="610.82" y="35.04" width="491.23" height="75.2">
          <div
            // @ts-expect-error -- foreignObject 内嵌 div 的 React 类型限制
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              width: "100%",
              height: "100%",
              opacity: 0.6,
              maskImage: "url(/images/landing/roadmap/timeline-mask-1.svg)",
              maskSize: "100% 100%",
              maskRepeat: "no-repeat",
              WebkitMaskImage: "url(/images/landing/roadmap/timeline-mask-1.svg)",
              WebkitMaskSize: "100% 100%",
              WebkitMaskRepeat: "no-repeat",
              backgroundImage: "url(/images/landing/roadmap/timeline-fill-2.svg)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right top",
            }}
          />
        </foreignObject>
      </svg>

      {/* 7 个月份 marker，绝对定位匹配 Figma 节点 x 坐标 */}
      {/* Figma 实测 x: 0, 181.67, 363.33, 545, 726.67, 929.33, 1132 */}
      <div className="absolute left-0 top-[50px] flex w-[1200px] items-center justify-between">
        {MONTHS.map((m) => (
          <RoadmapMarkerIcon key={m.num} month={m.num} label={m.label} />
        ))}
      </div>
    </div>
  );
}
