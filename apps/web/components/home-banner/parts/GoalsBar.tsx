interface GoalsBarProps {
  /** 当前球员进球数 */
  goals: number;
  /** 所有球员最高进球数（用于归一化） */
  maxGoals: number;
  /** 进度条容器宽度（像素），默认 71（Figma B4 规范） */
  width?: number;
}

/**
 * B4 金靴进度条（Figma 3229:207）
 * 71×7 圆角，纯黄 #fff42b 填充，白 20% 底
 * width = goals / maxGoals * 100%，最低 5% 保证可见
 */
export default function GoalsBar({ goals, maxGoals, width = 71 }: GoalsBarProps) {
  const ratio = maxGoals > 0 ? goals / maxGoals : 0;
  const pct = Math.max(5, ratio * 100);
  return (
    <div
      className="relative flex-shrink-0 rounded-full overflow-hidden"
      style={{
        width,
        height: 7,
        // @figma-hardcoded: rgba(255,255,255,0.2) goals-bar-track — pending design token
        background: "rgba(255,255,255,0.2)",
      }}
      aria-label={`${goals} goals`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${pct}%`,
          // @figma-hardcoded: #fff42b goals-bar-fill — pending design token
          background: "#fff42b",
        }}
      />
    </div>
  );
}
