import { useTranslations } from "next-intl";
import RoadmapTimeline from "./roadmap/RoadmapTimeline";
import MilestoneCard, { type MilestonePhase } from "./roadmap/MilestoneCard";

/**
 * §10 Roadmap Section
 * Figma 节点: 4227:195248 (Frame 481949, 1200.2×910.8)
 *
 * 关键规格（来自 Figma design_context）:
 * - 容器宽 1200×910.8, 上居中标题 "我们正在构建什么" (Noto Sans SC Bold 48/64, white)
 * - 时间轴位置 top-[89.8px], 含水平/竖线 + 7 月份 marker (RoadmapTimeline 子组件)
 * - 5 个阶段说明 Container 沿对角线阶梯排列 — 由 MilestoneCard 子组件渲染（含 hover 高亮 + popover）
 *
 * 交互（Figma 4218:191862 Property 1=Default/Variant2 + 4218:192010 timline popover）：
 * - Hover 时卡片青色 #28f4d2 从左向右 100% 填充（240ms）
 * - 卡片下方 24px 弹出 440px 宽 popover，含时间 + 4 条 ◆ bullet 子任务
 * - Popover 左边永远对齐 milestone 按钮左边（第 5 阶段会略溢出 1200 容器约 33px，section 实际更宽）
 *
 * 文案 mock：阶段 2-5 内容由产品提供后替换。
 */

/**
 * 阶段布局参数（不含文案）。Title/label/month/details 通过 i18n 注入。
 * `id` 用作稳定标识 + i18n key + Milestone 的"首/末"高度判定（80 vs 79）。
 */
type PhaseLayout = {
  id: "phase1" | "phase2" | "phase3" | "phase4" | "phase5";
  left: number;
  top: number;
  width: number;
};

const PHASE_LAYOUTS: PhaseLayout[] = [
  { id: "phase1", left: 0.1, top: 243.78, width: 331 },
  { id: "phase2", left: 119.1, top: 342.78, width: 304 },
  { id: "phase3", left: 363.33, top: 441.78, width: 361 },
  { id: "phase4", left: 566.1, top: 540.78, width: 398 },
  { id: "phase5", left: 1200 - 0.1 - 407, top: 639.78, width: 407 },
];

export default function RoadmapSection() {
  const t = useTranslations("landing.roadmap");
  const PHASES: MilestonePhase[] = PHASE_LAYOUTS.map((layout) => ({
    ...layout,
    label: t(`phases.${layout.id}.label`),
    title: t(`phases.${layout.id}.title`),
    month: t(`phases.${layout.id}.month`),
    details: t.raw(`phases.${layout.id}.details`) as string[],
  }));

  return (
    <section
      data-section="roadmap"
      data-figma-node="4227:195248"
      className="relative w-full bg-primary pb-[120px] pt-[120px]"
    >
      {/* 内层固定 1200×911 画布 — overflow-visible 让 popover 可溢出底部 */}
      <div className="relative mx-auto h-[911px] w-[1200px]">
        {/* 顶部居中标题 */}
        <h2
          data-figma-node="4227:195266"
          className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap font-noto-sc text-[48px] font-bold leading-[64px] text-white"
        >
          {t("title")}
        </h2>

        {/* 时间轴 */}
        <div data-figma-node="4227:195287" className="absolute left-0 top-[89.8px] w-[1200px]">
          <RoadmapTimeline />
        </div>

        {/* 5 个 Milestone（hover 高亮 + popover） */}
        {PHASES.map((p) => (
          <MilestoneCard key={p.label} phase={p} />
        ))}
      </div>
    </section>
  );
}
