import PoweredByAISparkIcon from "@/components/icons/landing/PoweredByAISparkIcon";

/**
 * Hero §1 子组件 — Powered by AI badge
 * Figma 节点: 4227:195085 (Overlay+Border)
 *
 * 规格（来自 Figma design_context）:
 * - 容器 bg-[rgba(255,255,255,0.1)] rounded-[100px]
 * - padding: px-[16px] py-[6px]
 * - 内部 gap: 7px
 * - Spark 图标 35×25.609
 * - 文字 Inter Medium 13px / lineHeight 20.8px / 白色
 */
export default function PoweredByAIBadge() {
  return (
    <div
      data-figma-node="4227:195085"
      // @figma-hardcoded: rgba(255,255,255,0.1) badge-bg — pending design token
      className="inline-flex shrink-0 items-center gap-[7px] rounded-[100px] bg-[rgba(255,255,255,0.1)] px-[16px] py-[6px]"
    >
      <PoweredByAISparkIcon className="h-[25.609px] w-[35px] shrink-0" />
      <span className="text-[13px] font-medium leading-[20.8px] text-white">Powered by AI</span>
    </div>
  );
}
