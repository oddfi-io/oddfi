import type { ReactNode } from "react";

export interface ComingSoonCta {
  label: string;
  onClick?: () => void;
  dataAttrs?: Record<string, string>;
}

export interface ComingSoonProps {
  title?: string;
  subtitle?: string;
  /**
   * 绝对定位的装饰层（如 mint glow、背景图）由外层注入；自身不带任何品牌装饰。
   */
  decorations?: ReactNode;
  /**
   * 标题上方的内容槽（如 Logo、徽标）；如不需要可省略。
   */
  header?: ReactNode;
  cta?: ComingSoonCta;
  /**
   * data-section 属性，便于截图回归与可访问性查询。
   */
  sectionId?: string;
}

/**
 * 通用 Coming Soon 占位组件（DD-106 Batch 2）。
 *
 * 设计意图：
 * - 不内嵌任何品牌装饰，所有视觉特化通过 `decorations` / `header` 槽注入。
 * - AI Agent H5 用法：`<ComingSoon title={t('...')} />`（极简）。
 * - 早鸟模式用法：传入 MintGlow + Logo + earlybird-gate CTA。
 */
export function ComingSoon({
  title,
  subtitle,
  decorations,
  header,
  cta,
  sectionId,
}: ComingSoonProps) {
  return (
    <section
      data-section={sectionId}
      className="relative flex min-h-[100svh] w-full flex-col items-center overflow-hidden bg-primary px-6 pt-[120px] pb-[80px] text-center"
    >
      {decorations}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8">
        {header}
        {(title || subtitle) && (
          <div className="space-y-3">
            {title && (
              <h1 className="text-fn-brand text-[44px] leading-[1.1] font-bold tracking-tight">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-2xl font-semibold tracking-wide text-primary">{subtitle}</p>
            )}
          </div>
        )}
      </div>

      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          style={{ touchAction: "manipulation" }}
          className="relative z-10 min-h-[52px] w-full max-w-[320px] rounded-full bg-fn-brand px-6 text-base font-semibold text-static-black transition active:scale-[0.98]"
          {...(cta.dataAttrs ?? {})}
        >
          {cta.label}
        </button>
      )}
    </section>
  );
}
