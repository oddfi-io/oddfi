// DD-095 BracketConnector — 严格按 Figma SVG 几何还原
// short=128（R32→R16）/ long=256（R16→QF）：[ 形带圆角 + 中点出线 15（合并 2 cell → 1 cell）
//   Figma SVG 资源：3b133986... + 9831c915...（line）
//   path: M0 0.5 H16 C20.4183 0.5 24 4.08172 24 8.5 V(h-8.5) C24 (h-4.08) 20.4183 (h-0.5) 16 (h-0.5) H0
// xlong=215（QF→SF）：单 L 形（┐ 顶端口 / ┘ 底端口），无出线
//   Figma SVG 资源：5e177f8d...
// stroke 颜色：#8B8D93（text-secondary token）— 通过 currentColor 继承

interface BracketConnectorProps {
  length: "short" | "long" | "xlong";
  /** direction='right' 默认开口（输出在右）；'left' 通过 scaleX(-1) 镜像（右半树用） */
  direction: "right" | "left";
  /** xlong 专用：top=┐（顶水平 + 垂直 down）/ bottom=┘（垂直 + 底水平） */
  cap?: "top" | "bottom";
  /** absolute 定位时的 top（默认 0） */
  top?: number;
}

const HEIGHTS: Record<BracketConnectorProps["length"], number> = {
  short: 128,
  long: 256,
  xlong: 215,
};

export default function BracketConnector({
  length,
  direction,
  cap = "top",
  top = 0,
}: BracketConnectorProps) {
  const h = HEIGHTS[length];
  const isXlong = length === "xlong";
  const w = isXlong ? 24 : 39;

  // Figma path 直接转录：圆角半径 8（控制点 20.4183 / 4.08172）
  let bridgePath: string;
  if (!isXlong) {
    // [ 形带圆角（合并桥）
    bridgePath = `M0 0.5 H16 C20.4183 0.5 24 4.08172 24 8.5 V${h - 8.5} C24 ${h - 4.08172} 20.4183 ${h - 0.5} 16 ${h - 0.5} H0`;
  } else if (cap === "top") {
    // ┐ 形（顶水平 + 圆角 + 垂直 down）
    bridgePath = `M0 0.5 H16 C20.4183 0.5 24 4.08172 24 8.5 V${h - 0.5}`;
  } else {
    // ┘ 形（垂直 down + 圆角 + 底水平）
    bridgePath = `M0 ${h - 0.5} H16 C20.4183 ${h - 0.5} 24 ${h - 4.08172} 24 ${h - 8.5} V0.5`;
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{
        position: top ? "absolute" : undefined,
        top: top || undefined,
        left: top ? 0 : undefined,
        transform: direction === "left" ? "scaleX(-1)" : undefined,
      }}
      className="text-secondary flex-shrink-0"
    >
      <path d={bridgePath} stroke="currentColor" strokeWidth={1} fill="none" />
      {!isXlong && (
        // 中点出线 15px（合并桥才有）
        <line x1={24} y1={h / 2} x2={w} y2={h / 2} stroke="currentColor" strokeWidth={1} />
      )}
    </svg>
  );
}
